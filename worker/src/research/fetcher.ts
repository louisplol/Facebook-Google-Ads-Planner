import type { Env } from "../env.ts";
import { rfetch } from "./http.ts";
import { BOT_USER_AGENT, ROBOTS_UA_TOKEN } from "./config.ts";

// Page reading. Competitor pages use a plain, guarded GET. The user's own pages go through
// Cloudflare Browser Rendering (when configured) so their scripts run and tracking tags show up.
// The plan's crawl endpoint wasn't verified at build time, so pages are discovered here
// (sitemap plus same-domain links) and each is read on its own.

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const NEARLY_EMPTY = 300;

export class FetchRefused extends Error {
  constructor(reason: string) {
    super(reason);
  }
}

// ---------- Address safety ----------

function ipv4Private(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6Private(ip: string): boolean {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::" || s === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (mapped) return ipv4Private(mapped[1]);
  // URL parsing turns ::ffff:10.0.0.1 into ::ffff:a00:1
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(s);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return ipv4Private(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
}

const isIpv4 = (h: string) => /^\d+\.\d+\.\d+\.\d+$/.test(h);
const isIpv6 = (h: string) => h.includes(":");

export type Resolver = (host: string) => Promise<string[]>;

/** Refuses anything that isn't a public http(s) address. */
export async function checkPublicUrl(raw: string, resolver?: Resolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchRefused("not a web address");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchRefused("only web pages can be read");
  if (url.username || url.password) throw new FetchRefused("addresses with passwords can't be read");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home.arpa") || !host.includes(".") && !isIpv6(host))
    throw new FetchRefused("private address");
  if (isIpv4(host) && ipv4Private(host)) throw new FetchRefused("private address");
  if (isIpv6(host) && ipv6Private(host)) throw new FetchRefused("private address");
  if (resolver && !isIpv4(host) && !isIpv6(host)) {
    const ips = await resolver(host);
    if (ips.some((ip) => (isIpv4(ip) ? ipv4Private(ip) : ipv6Private(ip)))) throw new FetchRefused("private address");
  }
  return url;
}

/** DNS over HTTPS lookup (Cloudflare), used to catch public names pointing at private addresses. */
export const dohResolver: Resolver = async (host) => {
  const out: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const res = await rfetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: "application/dns-json" } });
    if (!res.ok) continue;
    const data = (await res.json()) as { Answer?: { type: number; data: string }[] };
    for (const a of data.Answer ?? []) if (a.type === 1 || a.type === 28) out.push(a.data);
  }
  return out;
};

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

export interface FetchedPage {
  url: string;
  status: number;
  html: string;
  contentType: string;
}

/** Guarded GET: public http(s) only, 10 second timeout, 2 MB cap, redirects re-checked. */
export async function safeFetch(raw: string, opts: { resolver?: Resolver } = {}): Promise<FetchedPage> {
  let url = await checkPublicUrl(raw, opts.resolver);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await rfetch(url.toString(), { headers: { "User-Agent": BOT_USER_AGENT, Accept: "text/html,text/plain;q=0.9,*/*;q=0.5" }, redirect: "manual", signal: ctrl.signal });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = await checkPublicUrl(new URL(res.headers.get("location")!, url).toString(), opts.resolver);
        continue;
      }
      return { url: url.toString(), status: res.status, html: await readCapped(res), contentType: res.headers.get("content-type") ?? "" };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchRefused("too many redirects");
}

// ---------- HTML to text ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: "...", ndash: "-", mdash: "-" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/section|\/article)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export interface PageBits {
  title: string;
  h1s: string[];
  description: string;
  headline: string;
}

export function extractPageBits(html: string): PageBits {
  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => clean(m[1])).filter(Boolean);
  const description = clean(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html)?.[1] ?? /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html)?.[1] ?? "");
  const h2 = clean(/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html)?.[1] ?? "");
  return { title, h1s, description, headline: h1s[0] || h2 || title };
}

export interface TrackingFound {
  metaPixel: boolean;
  leadEvent: boolean;
  scheduleEvent: boolean;
  googleTag: boolean;
  tagManager: boolean;
}

export function detectTracking(html: string): TrackingFound {
  return {
    metaPixel: /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init['"]/i.test(html),
    leadEvent: /fbq\(\s*['"]track['"]\s*,\s*['"]Lead['"]/i.test(html),
    scheduleEvent: /fbq\(\s*['"]track['"]\s*,\s*['"]Schedule['"]/i.test(html),
    googleTag: /googletagmanager\.com\/gtag\/js|gtag\(\s*['"]config['"]/i.test(html),
    tagManager: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html),
  };
}

// ---------- robots.txt ----------

/** Longest-match Allow/Disallow for our user agent group, falling back to the * group. */
export function allowedByRobots(url: string, robotsTxt: string, ua = ROBOTS_UA_TOKEN): boolean {
  const path = (() => {
    const u = new URL(url);
    return u.pathname + u.search;
  })();
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false;
      if (val || key === "allow") current.rules.push({ allow: key === "allow", path: val });
    } else lastWasAgent = false;
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && ua.toLowerCase().includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules).filter((r) => r.path !== "");
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    const re = new RegExp(`^${r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`);
    if (re.test(path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) best = { allow: r.allow, len: r.path.length };
  }
  return best ? best.allow : true;
}

// ---------- Read a page ----------

export interface ReadPage {
  url: string;
  html: string;
  text: string;
  rendered: boolean;
  bits: PageBits;
  tracking: TrackingFound;
  browserMs: number;
}

export const browserConfigured = (env: Env) => !!(env.CF_ACCOUNT_ID && env.CF_BROWSER_TOKEN);

async function renderPage(env: Env, url: string): Promise<string> {
  const res = await rfetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/content`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_BROWSER_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, userAgent: BOT_USER_AGENT }),
  });
  if (!res.ok) throw new Error(`render_${res.status}`);
  const data = (await res.json()) as { success?: boolean; result?: string };
  return typeof data.result === "string" ? data.result : "";
}

/**
 * Static read first; a Browser Rendering re-read when the text is nearly empty (sites built with
 * JavaScript) or when `render` is set (the user's own pages, so tracking loaded by scripts shows).
 */
export async function readPage(env: Env, url: string, opts: { render?: boolean; resolver?: Resolver } = {}): Promise<ReadPage> {
  await checkPublicUrl(url, opts.resolver);
  let html = "";
  let finalUrl = url;
  try {
    const page = await safeFetch(url, opts);
    if (page.status >= 200 && page.status < 300) html = page.html;
    finalUrl = page.url;
  } catch (e) {
    if (e instanceof FetchRefused) throw e;
  }
  let text = htmlToText(html);
  let rendered = false;
  let browserMs = 0;
  if (browserConfigured(env) && (opts.render || text.length < NEARLY_EMPTY)) {
    const t0 = Date.now();
    try {
      const r = await renderPage(env, finalUrl);
      if (r) {
        html = r;
        text = htmlToText(r);
        rendered = true;
      }
    } catch {
      // keep the static read
    }
    browserMs = Date.now() - t0;
  }
  return { url: finalUrl, html, text, rendered, bits: extractPageBits(html), tracking: detectTracking(html), browserMs };
}

/** Same-domain links from a page, absolute, without fragments. */
export function sameDomainLinks(html: string, base: string): string[] {
  const b = new URL(base);
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], b);
      if ((u.protocol === "http:" || u.protocol === "https:") && u.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "")) {
        u.hash = "";
        if (!/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?)$/i.test(u.pathname)) out.add(u.toString());
      }
    } catch {
      // ignore bad links
    }
  }
  return [...out];
}

export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]));
}
