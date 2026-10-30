import type { Env } from "../env.ts";
import { intVar } from "../env.ts";
import { addDays, first, run, sha256 } from "../lib/db.ts";
import { ahrefsUnitsToday, recordSpend } from "../assist/budget.ts";
import { rfetch } from "./http.ts";
import { CACHE_DAYS } from "./config.ts";

// Ahrefs API v3. Claude may pick keywords, but this client controls the spend:
// fixed columns, hard row limits, a daily unit cap checked before every call, and a 30 day cache.
// Cost per click comes back in USD cents; the engine converts it.

const BASE = "https://api.ahrefs.com/v3";

export class CapError extends Error {
  constructor() {
    super("ahrefs_cap");
  }
}
export class AhrefsError extends Error {
  constructor(public status: number) {
    super(`ahrefs_${status}`);
  }
}

export interface AhrefsResult<T> {
  data: T[];
  raw: unknown;
  units: number;
  cached: boolean;
}

interface ReportSpec {
  path: string;
  select: string;
  /** Units per row for the selected columns (estimate; most columns 1, volume and intents 10) */
  perRow: number;
}

const REPORTS = {
  keyword_metrics: { path: "keywords-explorer/overview", select: "keyword,volume,cpc", perRow: 12 },
  matching_terms: { path: "keywords-explorer/matching-terms", select: "keyword,volume,cpc,intents", perRow: 22 },
  questions: { path: "keywords-explorer/matching-terms", select: "keyword,volume", perRow: 11 },
  serp: { path: "serp-overview/serp-overview", select: "url,title,position,type", perRow: 4 },
  paid_pages: { path: "site-explorer/paid-pages", select: "url,top_keyword,sum_traffic", perRow: 3 },
  site_metrics: { path: "site-explorer/metrics", select: "", perRow: 0 },
  organic_keywords: { path: "site-explorer/organic-keywords", select: "keyword,volume,best_position", perRow: 12 },
  organic_competitors: { path: "site-explorer/organic-competitors", select: "competitor_domain,keywords_common", perRow: 2 },
} satisfies Record<string, ReportSpec>;

export type AhrefsReport = keyof typeof REPORTS;

/** Hard row limits per report. */
export const ROW_LIMITS: Record<AhrefsReport, number> = {
  keyword_metrics: 15,
  matching_terms: 50,
  questions: 30,
  serp: 10,
  paid_pages: 20,
  site_metrics: 1,
  organic_keywords: 30,
  organic_competitors: 10,
};

export const estimateUnits = (report: AhrefsReport, rows: number) => Math.max(50, REPORTS[report].perRow * rows);

const ymd = () => new Date().toISOString().slice(0, 10);

function firstArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const v of Object.values(raw)) if (Array.isArray(v)) return v;
    const metrics = (raw as Record<string, unknown>).metrics;
    if (metrics && typeof metrics === "object") return [metrics];
  }
  return [];
}

function unitsFromHeaders(h: Headers): number | null {
  let total: number | null = null;
  h.forEach((v, k) => {
    if (k.toLowerCase().startsWith("x-api-units-cost")) {
      const n = Number(v);
      if (Number.isFinite(n)) total = Math.max(total ?? 0, n);
    }
  });
  return total;
}

async function call<T>(env: Env, report: AhrefsReport, params: Record<string, string | number>, rows: number): Promise<AhrefsResult<T>> {
  if (!env.AHREFS_API_KEY) throw new AhrefsError(401);
  const spec = REPORTS[report];
  const country = String(params.country ?? "");
  const query: Record<string, string> = { output: "json", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) };
  if (spec.select) query.select = spec.select;
  const keyHash = await sha256(`${report}|${JSON.stringify(Object.entries(query).sort())}|${country}`);

  const hit = await first<{ response_json: string }>(env.DB, "SELECT response_json FROM research_cache WHERE key_hash = ? AND expires_at > datetime('now')", keyHash);
  if (hit) {
    const raw = JSON.parse(hit.response_json);
    return { data: firstArray(raw).slice(0, rows) as T[], raw, units: 0, cached: true };
  }

  const estimate = estimateUnits(report, rows);
  const cap = intVar(env.AHREFS_DAILY_UNIT_CAP, 5000);
  if ((await ahrefsUnitsToday(env.DB)) + estimate > cap) throw new CapError();

  const res = await rfetch(`${BASE}/${spec.path}?${new URLSearchParams(query)}`, { headers: { Authorization: `Bearer ${env.AHREFS_API_KEY}`, Accept: "application/json" } });
  if (!res.ok) throw new AhrefsError(res.status);
  const raw = await res.json();
  const units = unitsFromHeaders(res.headers) ?? estimate;
  await recordSpend(env.DB, { ahrefsUnits: units });
  await run(
    env.DB,
    "INSERT OR REPLACE INTO research_cache (key_hash, source, report, params_json, country, response_json, units, expires_at) VALUES (?, 'ahrefs', ?, ?, ?, ?, ?, ?)",
    keyHash,
    report,
    JSON.stringify(query),
    country,
    JSON.stringify(raw),
    units,
    addDays(CACHE_DAYS),
  );
  return { data: firstArray(raw).slice(0, rows) as T[], raw, units, cached: false };
}

export interface KeywordRow {
  keyword: string;
  volume: number | null;
  cpc?: number | null;
  intents?: unknown;
}

const cc = (country: string) => country.toLowerCase();
const cleanSeeds = (seeds: string[], max: number) => [...new Set(seeds.map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, max);

export function keywordMetrics(env: Env, seeds: string[], country: string) {
  const kws = cleanSeeds(seeds, ROW_LIMITS.keyword_metrics);
  return call<KeywordRow>(env, "keyword_metrics", { keywords: kws.join(","), country: cc(country) }, kws.length || 1);
}

export function matchingTerms(env: Env, seeds: string[], country: string, opts: { questions?: boolean; limit?: number } = {}) {
  const report: AhrefsReport = opts.questions ? "questions" : "matching_terms";
  const limit = Math.min(opts.limit ?? ROW_LIMITS[report], ROW_LIMITS[report]);
  const params: Record<string, string | number> = { keywords: cleanSeeds(seeds, 10).join(","), country: cc(country), limit, order_by: "volume:desc" };
  if (opts.questions) params.terms = "questions";
  return call<KeywordRow>(env, report, params, limit);
}

export interface SerpRow {
  url: string | null;
  title: string | null;
  position: number | null;
  type: string[] | string | null;
}

export function serpOverview(env: Env, keyword: string, country: string) {
  return call<SerpRow>(env, "serp", { keyword: keyword.trim().toLowerCase(), country: cc(country), top_positions: ROW_LIMITS.serp }, ROW_LIMITS.serp);
}

export function paidPages(env: Env, domain: string, country: string) {
  return call<{ url: string; top_keyword: string | null; sum_traffic: number | null }>(
    env,
    "paid_pages",
    { target: domain, country: cc(country), date: ymd(), mode: "subdomains", limit: ROW_LIMITS.paid_pages, order_by: "sum_traffic:desc" },
    ROW_LIMITS.paid_pages,
  );
}

export function siteMetrics(env: Env, domain: string, country: string) {
  return call<{ org_traffic?: number; org_keywords?: number; paid_traffic?: number; paid_keywords?: number }>(env, "site_metrics", { target: domain, country: cc(country), date: ymd(), mode: "subdomains" }, 1);
}

export function organicKeywords(env: Env, domain: string, country: string) {
  return call<{ keyword: string; volume: number | null; best_position: number | null }>(
    env,
    "organic_keywords",
    { target: domain, country: cc(country), date: ymd(), mode: "subdomains", limit: ROW_LIMITS.organic_keywords, order_by: "sum_traffic:desc" },
    ROW_LIMITS.organic_keywords,
  );
}

export function organicCompetitors(env: Env, domain: string, country: string) {
  return call<{ competitor_domain: string; keywords_common: number | null }>(
    env,
    "organic_competitors",
    { target: domain, country: cc(country), date: ymd(), mode: "subdomains", limit: ROW_LIMITS.organic_competitors, order_by: "keywords_common:desc" },
    ROW_LIMITS.organic_competitors,
  );
}
