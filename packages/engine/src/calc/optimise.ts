import { BOTTLENECKS, type BottleneckRow, type FunnelRates } from "../method/bottlenecks.ts";
import { PLAYBOOK_RULES as P } from "../config/benchmarks.ts";

// ---------- Bottleneck checklist ----------

export interface BottleneckResult {
  first: BottleneckRow | null;
  afterThat: BottleneckRow[];
  triggered: number[];
}

export function evaluateBottlenecks(rates: FunnelRates): BottleneckResult {
  const triggered = BOTTLENECKS.filter((row) => row.test(rates));
  return { first: triggered[0] ?? null, afterThat: triggered.slice(1), triggered: triggered.map((r) => r.id) };
}

/** Funnel rates from period actuals (spend, impressions, clicks, leads, bookings, shows, deals). */
export interface PeriodActuals {
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  leads?: number | null;
  bookings?: number | null;
  shows?: number | null;
  deals?: number | null;
  revenue?: number | null;
}

export function ratesFromActuals(a: PeriodActuals, funnel: "1step" | "2step" = "2step"): FunnelRates {
  const div = (x?: number | null, y?: number | null) => (x != null && y != null && y > 0 ? x / y : null);
  return {
    ctr: div(a.clicks, a.impressions),
    optin: div(a.leads, a.clicks),
    booking: funnel === "2step" ? div(a.bookings, a.leads) : null,
    show: funnel === "2step" ? div(a.shows, a.bookings) : div(a.shows, a.leads),
    close: div(a.deals, a.shows),
  };
}

// ---------- Campaign playbook ----------

export type AdFlag = "pause" | "consider_pausing" | "tired" | "winner" | "leave_it" | "none";
export type AdSetTemp = "cold" | "warm";

export interface AdRow {
  name: string;
  adSet: string;
  spent: number;
  results: number;
  costPerResult?: number | null;
  ctr?: number | null;
  frequency?: number | null;
  impressions?: number | null;
}

export interface FlaggedAd extends AdRow {
  temp: AdSetTemp;
  flag: AdFlag;
  multipleOfTarget: number | null;
  reason: string;
  cpr: number | null;
}

export interface PlaybookResult {
  ads: FlaggedAd[];
  medianSpend: number;
  target: number;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const FLAG_LABELS: Record<AdFlag, string> = {
  pause: "Pause",
  consider_pausing: "Consider pausing",
  tired: "Tired",
  winner: "Winner",
  leave_it: "Leave it",
  none: "",
};

/**
 * Applies playbook rules 2 to 6 to each ad. Rows come back sorted by spend, highest first (rule 2).
 * Order of checks: zero-result outliers (rule 3), tired cold ads (rule 6), winners (rule 5), leave it (rule 4).
 */
export function applyPlaybook(ads: AdRow[], targetCpr: number, temps: Record<string, AdSetTemp>): PlaybookResult {
  const medianSpend = median(ads.map((a) => a.spent));
  const sorted = [...ads].sort((a, b) => b.spent - a.spent);
  const out = sorted.map<FlaggedAd>((ad) => {
    const temp = temps[ad.adSet] ?? "cold";
    const cpr = ad.results > 0 ? (ad.costPerResult ?? ad.spent / ad.results) : null;
    const multiple = targetCpr > 0 ? ad.spent / targetCpr : null;
    let flag: AdFlag = "none";
    let reason = "";
    if (ad.results === 0 && multiple !== null && multiple >= P.pauseMultiple.value) {
      flag = "pause";
      reason = `Spent ${multiple.toFixed(2)}x your target cost per result with no results (rule 3)`;
    } else if (ad.results === 0 && multiple !== null && multiple >= P.considerPausingMultiple.value) {
      flag = "consider_pausing";
      reason = `Spent ${multiple.toFixed(2)}x your target cost per result with no results (rule 3)`;
    } else if (temp === "cold" && (ad.frequency ?? 0) > P.tiredFrequency.value) {
      flag = "tired";
      reason = `Frequency ${ad.frequency} on a cold audience is above 2. Dial the budget back and make new ads (rule 6)`;
    } else if (cpr !== null && cpr <= targetCpr && ad.spent > medianSpend) {
      flag = "winner";
      reason = "At or under target among the top spenders. Find adjacent ideas (rule 5)";
    } else if (cpr !== null && cpr <= targetCpr && ad.spent < medianSpend) {
      flag = "leave_it";
      reason = "Low spend and at or under target: a small pocket audience. Leave it running (rule 4)";
    }
    return { ...ad, temp, flag, multipleOfTarget: multiple, reason, cpr };
  });
  return { ads: out, medianSpend, target: targetCpr };
}

// ---------- Review cadence (rule 7) ----------

export function nextReviewDate(lastImport: Date): Date {
  return new Date(lastImport.getTime() + P.reviewDaysMin.value * 86400000);
}

export function tooSoonToJudge(lastImport: Date | null, now: Date): boolean {
  if (!lastImport) return false;
  return now.getTime() - lastImport.getTime() < P.reviewDaysMin.value * 86400000;
}

// ---------- CSV import ----------

/** Minimal CSV parser (quotes, commas, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<keyof AdRow, string[]> = {
  name: ["ad name", "ad", "name"],
  adSet: ["ad set name", "ad set", "adset"],
  spent: ["amount spent", "amount spent (aud)", "amount spent (usd)", "spend", "cost"],
  results: ["results", "conversions"],
  costPerResult: ["cost per result", "cost per results", "cost / conv.", "cost per conversion"],
  ctr: ["ctr (link click-through rate)", "link ctr", "ctr"],
  frequency: ["frequency"],
  impressions: ["impressions", "impr."],
};

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const cleaned = s.replace(/[$,%\s]|AUD|USD/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
};

/** Reads an Ads Manager export (Performance and Clicks view plus Frequency). */
export function importAdsCsv(text: string): { ads: AdRow[]; errors: string[] } {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const errors: string[] = [];
  if (rows.length < 2) return { ads: [], errors: ["The file has no rows."] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (key: keyof AdRow) => header.findIndex((h) => HEADER_ALIASES[key].some((a) => h === a || h.startsWith(a)));
  const idx = Object.fromEntries((Object.keys(HEADER_ALIASES) as (keyof AdRow)[]).map((k) => [k, col(k)])) as Record<keyof AdRow, number>;
  for (const req of ["name", "spent", "results"] as const) {
    if (idx[req] < 0) errors.push(`Missing a column for ${HEADER_ALIASES[req][0]}.`);
  }
  if (errors.length) return { ads: [], errors };
  const ads: AdRow[] = [];
  for (const r of rows.slice(1)) {
    const name = r[idx.name]?.trim();
    if (!name || name.toLowerCase().startsWith("total")) continue;
    const ctrRaw = idx.ctr >= 0 ? num(r[idx.ctr]) : null;
    ads.push({
      name,
      adSet: idx.adSet >= 0 ? (r[idx.adSet]?.trim() ?? "") : "",
      spent: num(r[idx.spent]) ?? 0,
      results: num(r[idx.results]) ?? 0,
      costPerResult: idx.costPerResult >= 0 ? num(r[idx.costPerResult]) : null,
      // Ads Manager shows CTR as a percentage figure (1.25 = 1.25%)
      ctr: ctrRaw === null ? null : ctrRaw / 100,
      frequency: idx.frequency >= 0 ? num(r[idx.frequency]) : null,
      impressions: idx.impressions >= 0 ? num(r[idx.impressions]) : null,
    });
  }
  return { ads, errors };
}
