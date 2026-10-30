import { createTestD1 } from "./d1-shim.ts";
import type { Env } from "../worker/src/env.ts";

export function testEnv(over: Partial<Env> = {}): Env {
  return {
    DB: createTestD1(),
    ENVIRONMENT: "test",
    BRAND_NAME: "Test Workbook",
    ASSIST_ENABLED: "true",
    RESEARCH_ENABLED: "true",
    AI_MONTHLY_BUDGET_USD: "50",
    AHREFS_DAILY_UNIT_CAP: "5000",
    ASSIST_DAILY_ANON: "10",
    ASSIST_DAILY_SAVED: "60",
    RESEARCH_DAILY_SAVED: "5",
    ...over,
  } as Env;
}

/** Minimal cookie-jar client around app.request. */
export function client(app: { request: (url: string, init: RequestInit, env: Env, ctx?: ExecutionContext) => Response | Promise<Response> }, env: Env) {
  let cookie = "";
  const waits: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException: () => undefined, props: {} } as unknown as ExecutionContext;
  const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(
      `http://localhost${url}`,
      { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" },
      env,
      ctx,
    );
    const set = res.headers.get("set-cookie");
    if (set) {
      const m = /pmw_sid=([^;]*)/.exec(set);
      if (m) cookie = m[1] ? `pmw_sid=${m[1]}` : "";
    }
    return res;
  };
  return {
    get: (u: string, h?: Record<string, string>) => call("GET", u, undefined, h),
    post: (u: string, b?: unknown, h?: Record<string, string>) => call("POST", u, b ?? {}, h),
    put: (u: string, b?: unknown) => call("PUT", u, b),
    patch: (u: string, b?: unknown) => call("PATCH", u, b),
    del: (u: string) => call("DELETE", u),
    setCookie: (c: string) => (cookie = c),
    getCookie: () => cookie,
    settle: () => Promise.all(waits.splice(0)),
  };
}

/** Reads an SSE response into events. */
export async function readSse(res: Response): Promise<{ event: string; data: any }[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((b) => b.trim())
    .map((b) => {
      const ev = /event: (.*)/.exec(b)?.[1] ?? "message";
      const data = b
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("\n");
      return { event: ev, data: data ? JSON.parse(data) : null };
    });
}
