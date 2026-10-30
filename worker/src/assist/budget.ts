import type { Env } from "../env.ts";
import { intVar } from "../env.ts";
import { first, run, today, monthStart } from "../lib/db.ts";

export type UsageKind = "assist" | "research";

export async function usageToday(db: D1Database, userId: string, kind: UsageKind): Promise<number> {
  const r = await first<{ count: number }>(db, "SELECT count FROM usage_counters WHERE user_id = ? AND day = ? AND kind = ?", userId, today(), kind);
  return r?.count ?? 0;
}

export function allowance(env: Env, kind: UsageKind, saved: boolean): number {
  if (kind === "research") return saved ? intVar(env.RESEARCH_DAILY_SAVED, 5) : 0;
  return saved ? intVar(env.ASSIST_DAILY_SAVED, 60) : intVar(env.ASSIST_DAILY_ANON, 10);
}

export async function bumpUsage(db: D1Database, userId: string, kind: UsageKind) {
  await run(db, "INSERT INTO usage_counters (user_id, day, kind, count) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, day, kind) DO UPDATE SET count = count + 1", userId, today(), kind);
}

export async function monthToDateCost(db: D1Database): Promise<number> {
  const r = await first<{ total: number }>(db, "SELECT COALESCE(SUM(claude_cost_usd), 0) AS total FROM spend_daily WHERE day >= ?", monthStart());
  return r?.total ?? 0;
}

/** Hard stop: assists pause when month-to-date cost reaches the budget. */
export async function overBudget(env: Env): Promise<boolean> {
  return (await monthToDateCost(env.DB)) >= intVar(env.AI_MONTHLY_BUDGET_USD, 50);
}

export async function ahrefsUnitsToday(db: D1Database): Promise<number> {
  const r = await first<{ ahrefs_units: number }>(db, "SELECT ahrefs_units FROM spend_daily WHERE day = ?", today());
  return r?.ahrefs_units ?? 0;
}

export async function recordSpend(db: D1Database, add: { claude?: number; webSearches?: number; ahrefsUnits?: number; browserMs?: number }) {
  await run(
    db,
    `INSERT INTO spend_daily (day, claude_cost_usd, web_searches, ahrefs_units, browser_ms) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET claude_cost_usd = claude_cost_usd + excluded.claude_cost_usd, web_searches = web_searches + excluded.web_searches,
     ahrefs_units = ahrefs_units + excluded.ahrefs_units, browser_ms = browser_ms + excluded.browser_ms`,
    today(),
    add.claude ?? 0,
    add.webSearches ?? 0,
    add.ahrefsUnits ?? 0,
    add.browserMs ?? 0,
  );
}
