import { Hono } from "hono";
import { SECTIONS, packByKey } from "@pmw/engine";
import { requireAdmin, type AdminEnv } from "../lib/admin-auth.ts";
import { all, first, parseJson, monthStart, today } from "../lib/db.ts";
import { intVar } from "../env.ts";

// Read-only admin. Every route requires the owner (Access JWT + ADMIN_EMAILS, or the local dev token)
// and every view is written to admin_audit. There are no write routes here by design.

export const admin = new Hono<AdminEnv>();
admin.use("*", requireAdmin);

const range = (q: Record<string, string | undefined>) => ({
  from: q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from) ? q.from : "2000-01-01",
  to: q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to) ? `${q.to} 23:59:59` : "2999-12-31",
});

admin.get("/whoami", (c) => c.json({ email: c.get("adminEmail") }));

admin.get("/overview", async (c) => {
  const { from, to } = range(c.req.query());
  const db = c.env.DB;
  const n = async (sql: string, ...p: unknown[]) => (await first<{ n: number }>(db, sql, ...p))?.n ?? 0;
  const spend = await first<{ cost: number; searches: number }>(db, "SELECT COALESCE(SUM(claude_cost_usd),0) AS cost, COALESCE(SUM(web_searches),0) AS searches FROM spend_daily WHERE day >= ?", monthStart());
  const unitsToday = await n("SELECT COALESCE(ahrefs_units,0) AS n FROM spend_daily WHERE day = ?", today());
  return c.json({
    users: await n("SELECT COUNT(*) AS n FROM users WHERE created_at BETWEEN ? AND ?", from, to),
    savedUsers: await n("SELECT COUNT(*) AS n FROM users WHERE email_verified_at IS NOT NULL AND created_at BETWEEN ? AND ?", from, to),
    workspaces: await n("SELECT COUNT(*) AS n FROM workspaces WHERE created_at BETWEEN ? AND ?", from, to),
    onboarded: await n("SELECT COUNT(*) AS n FROM workspaces WHERE onboarding_done_at IS NOT NULL AND created_at BETWEEN ? AND ?", from, to),
    activeLast7: await n("SELECT COUNT(DISTINCT workspace_id) AS n FROM events WHERE created_at >= datetime('now','-7 days')"),
    assists: await n("SELECT COUNT(*) AS n FROM ai_runs WHERE created_at BETWEEN ? AND ?", from, to),
    researchRuns: await n("SELECT COUNT(*) AS n FROM research_runs WHERE started_at BETWEEN ? AND ?", from, to),
    monthToDate: {
      claudeCostUsd: spend?.cost ?? 0,
      budgetUsd: intVar(c.env.AI_MONTHLY_BUDGET_USD, 50),
      webSearches: spend?.searches ?? 0,
      ahrefsUnitsToday: unitsToday,
      ahrefsDailyCap: intVar(c.env.AHREFS_DAILY_UNIT_CAP, 5000),
    },
    spendSeries: await all(db, "SELECT day, claude_cost_usd, web_searches, ahrefs_units FROM spend_daily ORDER BY day DESC LIMIT 60"),
    industries: await all(db, "SELECT COALESCE(industry_pack,'(not set)') AS industry, COUNT(*) AS n FROM workspaces GROUP BY 1 ORDER BY n DESC"),
  });
});

admin.get("/activity", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const rows = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT e.id, e.type, e.data_json, e.created_at, e.workspace_id, w.company, w.name, u.email
     FROM events e LEFT JOIN workspaces w ON w.id = e.workspace_id LEFT JOIN users u ON u.id = COALESCE(e.user_id, w.user_id)
     ORDER BY e.id DESC LIMIT ?`,
    limit,
  );
  return c.json({ events: rows.map((r) => ({ ...r, data: parseJson(r.data_json as string, {}), data_json: undefined })) });
});

admin.get("/funnel", async (c) => {
  const industry = c.req.query("industry");
  const channel = c.req.query("channel");
  const where: string[] = [];
  const p: unknown[] = [];
  if (industry) {
    where.push("industry_pack = ?");
    p.push(industry);
  }
  if (channel) {
    where.push("channel = ?");
    p.push(channel);
  }
  const ws = await all<{ id: string; onboarding_step: number; onboarding_done_at: string | null; completed_sections: string }>(
    c.env.DB,
    `SELECT id, onboarding_step, onboarding_done_at, completed_sections FROM workspaces ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    ...p,
  );
  const started = ws.length;
  const onboarded = ws.filter((w) => w.onboarding_done_at).length;
  const sections = SECTIONS.map((s) => ({ id: s.id, number: s.number, title: s.title, completed: ws.filter((w) => parseJson<string[]>(w.completed_sections, []).includes(s.id)).length }));
  const steps: Record<number, number> = {};
  for (const w of ws) steps[w.onboarding_step] = (steps[w.onboarding_step] ?? 0) + 1;
  return c.json({ started, onboarded, onboardingSteps: steps, sections });
});

admin.get("/workspaces", async (c) => {
  const q = c.req.query("q")?.trim();
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
  const like = q ? `%${q}%` : null;
  const rows = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT w.id, w.name, w.company, w.website, w.industry_pack, w.channel, w.funnel_type, w.service_city, w.completed_sections, w.onboarding_done_at, w.created_at, w.updated_at,
            u.email, (SELECT COUNT(*) FROM answers a WHERE a.workspace_id = w.id) AS answer_count,
            (SELECT COUNT(*) FROM ai_runs r WHERE r.workspace_id = w.id) AS assist_count
     FROM workspaces w JOIN users u ON u.id = w.user_id
     ${like ? "WHERE w.company LIKE ? OR w.name LIKE ? OR u.email LIKE ? OR w.website LIKE ?" : ""}
     ORDER BY w.updated_at DESC LIMIT ? OFFSET ?`,
    ...(like ? [like, like, like, like] : []),
    limit,
    offset,
  );
  return c.json({ workspaces: rows.map((r) => ({ ...r, completed: parseJson<string[]>(r.completed_sections as string, []).length, completed_sections: undefined })) });
});

admin.get("/workspaces/:id", async (c) => {
  const id = c.req.param("id");
  const ws = await first<Record<string, unknown>>(c.env.DB, "SELECT w.*, u.email, u.email_verified_at FROM workspaces w JOIN users u ON u.id = w.user_id WHERE w.id = ?", id);
  if (!ws) return c.json({ error: "not_found" }, 404);
  const answers = await all<{ module: string; field_id: string; value_json: string; updated_at: string }>(c.env.DB, "SELECT module, field_id, value_json, updated_at FROM answers WHERE workspace_id = ? ORDER BY module, field_id", id);
  const site = await first<Record<string, unknown>>(c.env.DB, "SELECT * FROM site_profiles WHERE workspace_id = ?", id);
  const runs = await all<Record<string, unknown>>(c.env.DB, "SELECT id, section, field_id, action, model, cost_usd, latency_ms, output_json, used, rating, error, created_at FROM ai_runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 200", id);
  const research = await all<Record<string, unknown>>(c.env.DB, "SELECT * FROM research_runs WHERE workspace_id = ? ORDER BY started_at DESC LIMIT 100", id);
  const events = await all<Record<string, unknown>>(c.env.DB, "SELECT type, data_json, created_at FROM events WHERE workspace_id = ? ORDER BY id DESC LIMIT 200", id);
  const scenarios = await all<Record<string, unknown>>(c.env.DB, "SELECT name, overrides_json, updated_at FROM scenarios WHERE workspace_id = ?", id);
  return c.json({
    workspace: { ...ws, completed_sections: parseJson(ws.completed_sections as string, []) },
    answers: answers.map((a) => ({ ...a, ...parseJson<{ value: unknown; origin: string }>(a.value_json, { value: null, origin: "user" }), value_json: undefined })),
    site: site ? { ...site, profile: parseJson(site.profile_json as string, {}), tracking: parseJson(site.tracking_json as string, {}), ahrefs: parseJson(site.ahrefs_json as string, {}), pages: parseJson(site.pages_json as string, []) } : null,
    assists: runs.map((r) => ({ ...r, output: parseJson(r.output_json as string, null), output_json: undefined })),
    research: research.map((r) => ({ ...r, result: parseJson(r.result_json as string, null), sources: parseJson(r.sources_json as string, []), params: parseJson(r.params_json as string, {}) })),
    events: events.map((e) => ({ ...e, data: parseJson(e.data_json as string, {}) })),
    scenarios,
  });
});

admin.get("/assists", async (c) => {
  const q = c.req.query();
  const where: string[] = ["1=1"];
  const p: unknown[] = [];
  for (const [k, col] of [
    ["action", "r.action"],
    ["section", "r.section"],
    ["model", "r.model"],
    ["industry", "w.industry_pack"],
  ] as const) {
    if (q[k]) {
      where.push(`${col} = ?`);
      p.push(q[k]);
    }
  }
  const W = `FROM ai_runs r LEFT JOIN workspaces w ON w.id = r.workspace_id WHERE ${where.join(" AND ")}`;
  const byAction = await all(c.env.DB, `SELECT r.action, COUNT(*) AS runs, SUM(r.used) AS used, SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS up, SUM(CASE WHEN r.rating = -1 THEN 1 ELSE 0 END) AS down, ROUND(SUM(r.cost_usd), 4) AS cost, SUM(CASE WHEN r.error IS NOT NULL THEN 1 ELSE 0 END) AS errors ${W} GROUP BY r.action ORDER BY runs DESC`, ...p);
  const bySection = await all(c.env.DB, `SELECT r.section, COUNT(*) AS runs, SUM(r.used) AS used ${W} GROUP BY r.section ORDER BY runs DESC`, ...p);
  const ignored = await all(c.env.DB, `SELECT r.field_id, COUNT(*) AS runs, SUM(r.used) AS used, ROUND(1.0 - CAST(SUM(r.used) AS REAL) / COUNT(*), 2) AS ignore_rate ${W} AND r.error IS NULL GROUP BY r.field_id HAVING runs >= 3 ORDER BY ignore_rate DESC LIMIT 20`, ...p);
  const models = await all(c.env.DB, `SELECT r.model, COUNT(*) AS runs, ROUND(SUM(r.cost_usd), 4) AS cost, ROUND(AVG(r.latency_ms)) AS avg_ms ${W} GROUP BY r.model`, ...p);
  const completed = await first<{ n: number; cost: number }>(
    c.env.DB,
    `SELECT COUNT(DISTINCT w.id) AS n, COALESCE((SELECT SUM(cost_usd) FROM ai_runs WHERE workspace_id IN (SELECT id FROM workspaces WHERE completed_sections LIKE '%"optimising"%')), 0) AS cost FROM workspaces w WHERE w.completed_sections LIKE '%"optimising"%'`,
  );
  const recent = await all(c.env.DB, `SELECT r.id, r.workspace_id, r.field_id, r.action, r.model, r.used, r.rating, r.cost_usd, r.error, r.created_at ${W} ORDER BY r.created_at DESC LIMIT 50`, ...p);
  return c.json({ byAction, bySection, ignored, models, costPerCompletedWorkbook: completed && completed.n ? completed.cost / completed.n : null, completedWorkbooks: completed?.n ?? 0, recent });
});

admin.get("/research", async (c) => {
  const recipe = c.req.query("recipe");
  const { from } = range(c.req.query());
  const where = recipe ? "AND recipe = ?" : "";
  const p = recipe ? [from, recipe] : [from];
  const byRecipe = await all(
    c.env.DB,
    `SELECT recipe, COUNT(*) AS runs, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failures, ROUND(AVG(cost_usd), 4) AS avg_cost, SUM(ahrefs_units) AS units, SUM(cache_hits) AS cache_hits FROM research_runs WHERE started_at >= ? ${where} GROUP BY recipe`,
    ...p,
  );
  const unitsPerDay = await all(c.env.DB, "SELECT day, ahrefs_units FROM spend_daily ORDER BY day DESC LIMIT 30");
  const cache = await first<{ rows: number; units: number }>(c.env.DB, "SELECT COUNT(*) AS rows, COALESCE(SUM(units),0) AS units FROM research_cache");
  const failures = await all(c.env.DB, `SELECT id, workspace_id, recipe, error, started_at FROM research_runs WHERE status = 'failed' AND started_at >= ? ${where} ORDER BY started_at DESC LIMIT 30`, ...p);
  return c.json({ byRecipe, unitsPerDay, cache, failures });
});

admin.get("/spend", async (c) => c.json({ days: await all(c.env.DB, "SELECT * FROM spend_daily ORDER BY day DESC LIMIT 90") }));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

admin.get("/insights", async (c) => {
  const industry = c.req.query("industry");
  const country = c.req.query("country");
  const where: string[] = ["(a.field_id LIKE 'av_away_%' OR a.field_id LIKE 'av_towards_%' OR a.field_id LIKE 'av_attempts_%')"];
  const p: unknown[] = [];
  if (industry) {
    where.push("w.industry_pack = ?");
    p.push(industry);
  }
  if (country) {
    where.push("w.country = ?");
    p.push(country);
  }
  const rows = await all<{ field_id: string; value_json: string; industry_pack: string | null }>(
    c.env.DB,
    `SELECT a.field_id, a.value_json, w.industry_pack FROM answers a JOIN workspaces w ON w.id = a.workspace_id WHERE ${where.join(" AND ")}`,
    ...p,
  );
  type Bucket = Record<string, { text: string; count: number }>;
  const groups: Record<string, Record<string, Bucket>> = {};
  for (const r of rows) {
    const v = parseJson<{ value: unknown }>(r.value_json, { value: null }).value;
    if (typeof v !== "string" || !v.trim()) continue;
    const kind = r.field_id.startsWith("av_away") ? "pains" : r.field_id.startsWith("av_towards") ? "motivators" : "attempts";
    const ind = packByKey(r.industry_pack).label;
    const k = norm(v);
    const g = ((groups[ind] ??= {})[kind] ??= {});
    g[k] = { text: g[k]?.text ?? v.trim(), count: (g[k]?.count ?? 0) + 1 };
  }
  const insights = Object.entries(groups).map(([ind, kinds]) => ({
    industry: ind,
    ...Object.fromEntries(Object.entries(kinds).map(([kind, b]) => [kind, Object.values(b).sort((x, y) => y.count - x.count).slice(0, 15)])),
  }));
  const kw = await all<{ result_json: string; started_at: string }>(c.env.DB, "SELECT result_json, started_at FROM research_runs WHERE recipe IN ('search_demand','keyword_plan') AND status = 'done' ORDER BY started_at DESC LIMIT 200");
  const keywords = new Map<string, { keyword: string; volume: number | null; checked: string }>();
  for (const r of kw) {
    const res = parseJson<{ terms?: { keyword: string; volume: number | null }[]; keywords?: { keyword: string; volume: number | null }[] }>(r.result_json, {});
    for (const t of [...(res.terms ?? []), ...(res.keywords ?? [])]) if (!keywords.has(t.keyword)) keywords.set(t.keyword, { ...t, checked: r.started_at });
  }
  return c.json({ insights, keywords: [...keywords.values()].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 200) });
});
