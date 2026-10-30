import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Env } from "../env.ts";
import { first, newId, randomToken, run, sha256, addDays } from "./db.ts";

export const SESSION_COOKIE = "pmw_sid";
const SESSION_DAYS = 400;

export interface SessionUser {
  id: string;
  email: string | null;
  email_verified_at: string | null;
  consent_version: number | null;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser; sessionHash: string } };

export function cookieOptions(c: Context) {
  const secure = new URL(c.req.url).protocol === "https:";
  return { httpOnly: true, secure, sameSite: "Lax" as const, path: "/", maxAge: SESSION_DAYS * 86400 };
}

export async function createSession(c: Context<AppEnv>, userId: string): Promise<string> {
  const token = randomToken(32);
  const hash = await sha256(token);
  await run(c.env.DB, "INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)", hash, userId, addDays(SESSION_DAYS));
  setCookie(c, SESSION_COOKIE, token, cookieOptions(c));
  return hash;
}

async function loadUser(c: Context<AppEnv>): Promise<{ user: SessionUser; hash: string } | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const hash = await sha256(token);
  const user = await first<SessionUser>(
    c.env.DB,
    `SELECT u.id, u.email, u.email_verified_at, u.consent_version FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id_hash = ? AND s.expires_at > datetime('now')`,
    hash,
  );
  return user ? { user, hash } : null;
}

/** Every visitor gets an anonymous user and a session cookie on first contact. */
export const session = (opts: { create: boolean }): MiddlewareHandler<AppEnv> => async (c, next) => {
  // "/x/*" also matches "/x" in Hono, so this can run twice for one request.
  if (c.get("user")) return next();
  let loaded = await loadUser(c);
  if (!loaded) {
    if (!opts.create) return c.json({ error: "no_session" }, 401);
    const id = newId("u_");
    await run(c.env.DB, "INSERT INTO users (id) VALUES (?)", id);
    const hash = await createSession(c, id);
    loaded = { user: { id, email: null, email_verified_at: null, consent_version: null }, hash };
  }
  c.set("user", loaded.user);
  c.set("sessionHash", loaded.hash);
  await next();
};

export const isSaved = (u: SessionUser) => !!u.email_verified_at;
