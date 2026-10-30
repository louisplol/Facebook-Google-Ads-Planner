import type { Env } from "./env.ts";
import { intVar } from "./env.ts";
import { all, run } from "./lib/db.ts";
import { monthToDateCost, ahrefsUnitsToday } from "./assist/budget.ts";
import { sendEmail } from "./lib/email.ts";

/** Daily: spend alerts at 80% of caps, and clean up expired uploads, cache rows and old runs. */
export async function scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(dailyJobs(env));
}

export async function dailyJobs(env: Env): Promise<{ alerts: string[] }> {
  const alerts: string[] = [];
  const budget = intVar(env.AI_MONTHLY_BUDGET_USD, 50);
  const cost = await monthToDateCost(env.DB);
  if (cost >= budget * 0.8) alerts.push(`Writing and research cost this month is $${cost.toFixed(2)} of the $${budget} budget.`);
  const cap = intVar(env.AHREFS_DAILY_UNIT_CAP, 5000);
  const units = await ahrefsUnitsToday(env.DB);
  if (units >= cap * 0.8) alerts.push(`Market data units today: ${units} of ${cap}.`);
  if (alerts.length && env.ALERT_EMAIL) {
    await sendEmail(env, env.ALERT_EMAIL, `${env.BRAND_NAME || "Workbook"}: spend alert`, alerts.join("\n")).catch(() => undefined);
  }

  const expired = await all<{ id: string; r2_key: string }>(env.DB, "SELECT id, r2_key FROM uploads WHERE expires_at < datetime('now')");
  for (const u of expired) {
    await env.UPLOADS?.delete(u.r2_key);
    await run(env.DB, "DELETE FROM uploads WHERE id = ?", u.id);
  }
  await run(env.DB, "DELETE FROM research_cache WHERE expires_at < datetime('now')");
  await run(env.DB, "DELETE FROM ai_runs WHERE created_at < datetime('now', '-12 months')");
  await run(env.DB, "DELETE FROM rate_limits WHERE window_start < ?", Math.floor(Date.now() / 1000) - 86400);
  await run(env.DB, "DELETE FROM sessions WHERE expires_at < datetime('now')");
  return { alerts };
}
