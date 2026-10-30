import type { Context } from "hono";
import type { Env } from "../env.ts";
import type { AppEnv } from "./session.ts";
import { first, run } from "./db.ts";

/** Fixed window rate limit stored in D1. Returns true when allowed. */
export async function rateLimit(db: D1Database, key: string, limit: number, windowSec = 60): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / windowSec) * windowSec;
  await run(db, "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1", key, window);
  const row = await first<{ count: number }>(db, "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?", key, window);
  return (row?.count ?? 0) <= limit;
}

export const clientIp = (c: Context) => c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

/** Loads a workspace and checks the session owns it. */
export async function ownedWorkspace<T = Record<string, unknown>>(c: Context<AppEnv>, id: string): Promise<T | null> {
  return first<T>(c.env.DB, "SELECT * FROM workspaces WHERE id = ? AND user_id = ?", id, c.get("user").id);
}

/** Cloudflare Turnstile server check. */
export async function verifyTurnstile(env: Env, token: string | undefined, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return env.ENVIRONMENT !== "production";
  if (!token) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = (await res.json()) as { success?: boolean };
  return !!data.success;
}
