import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.ts";
import { isDev } from "../env.ts";
import { run } from "./db.ts";

// The admin is for the owner only.
// Production: Cloudflare Access sits in front of /admin and /api/admin and signs a JWT.
// The Worker verifies that JWT itself (signature, audience, expiry) and then checks the
// email against ADMIN_EMAILS, so a misconfigured Access policy still can't let anyone else in.
// Local development: Access isn't present, so a long random ADMIN_DEV_TOKEN is required instead.

export type AdminEnv = { Bindings: Env; Variables: { adminEmail: string } };

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

let certCache: { at: number; team: string; keys: Jwk[] } | null = null;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

const teamHost = (team: string) => (team.includes(".") ? team.replace(/^https?:\/\//, "").replace(/\/$/, "") : `${team}.cloudflareaccess.com`);

async function accessKeys(team: string, fetcher: typeof fetch = fetch): Promise<Jwk[]> {
  if (certCache && certCache.team === team && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const res = await fetcher(`https://${teamHost(team)}/cdn-cgi/access/certs`);
  const data = (await res.json()) as { keys: Jwk[] };
  certCache = { at: Date.now(), team, keys: data.keys };
  return data.keys;
}

export async function verifyAccessJwt(token: string, env: Env, fetcher: typeof fetch = fetch): Promise<{ email: string } | null> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0]))) as { kid?: string; alg?: string };
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as { aud?: string | string[]; exp?: number; iss?: string; email?: string };
    if (header.alg !== "RS256") return null;
    const keys = await accessKeys(env.ACCESS_TEAM_DOMAIN, fetcher);
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(env.ACCESS_AUD)) return null;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    if (payload.iss && payload.iss !== `https://${teamHost(env.ACCESS_TEAM_DOMAIN)}`) return null;
    return payload.email ? { email: payload.email.toLowerCase() } : null;
  } catch {
    return null;
  }
}

export const adminEmails = (env: Env) =>
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const requireAdmin: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const env = c.env;
  let email: string | null = null;

  const jwt = c.req.header("cf-access-jwt-assertion");
  if (jwt) {
    const verified = await verifyAccessJwt(jwt, env);
    if (verified && adminEmails(env).includes(verified.email)) email = verified.email;
  } else if (isDev(env) && env.ADMIN_DEV_TOKEN && env.ADMIN_DEV_TOKEN.length >= 16) {
    const token = c.req.header("x-admin-token") ?? "";
    if (timingSafeEqual(token, env.ADMIN_DEV_TOKEN)) email = "local-admin";
  }

  if (!email) return c.json({ error: "forbidden" }, 403);
  c.set("adminEmail", email);
  const url = new URL(c.req.url);
  await run(env.DB, "INSERT INTO admin_audit (admin_email, route, params_json) VALUES (?, ?, ?)", email, url.pathname, JSON.stringify(Object.fromEntries(url.searchParams)));
  await next();
};
