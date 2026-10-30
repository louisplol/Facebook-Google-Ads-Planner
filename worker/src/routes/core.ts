import { Hono } from "hono";
import { z } from "zod";
import { packByKey, sectionForField, SECTIONS } from "@pmw/engine";
import type { AppEnv } from "../lib/session.ts";
import { session, createSession, isSaved, SESSION_COOKIE, cookieOptions } from "../lib/session.ts";
import { all, first, newId, run, parseJson, randomToken, sha256, addDays } from "../lib/db.ts";
import { ownedWorkspace, rateLimit, clientIp } from "../lib/guards.ts";
import { sendEmail } from "../lib/email.ts";
import { flag, intVar, isDev } from "../env.ts";
import { setCookie } from "hono/cookie";

export const core = new Hono<AppEnv>();

const FIELD_ID = /^[a-z0-9_]{1,64}$/;
const MAX_VALUE_BYTES = 64 * 1024;

export const EVENT_TYPES = new Set([
  "section_viewed",
  "section_completed",
  "checklist_ticked",
  "onboarding_step",
  "onboarding_completed",
  "assist_requested",
  "assist_used",
  "assist_rated",
  "research_started",
  "research_completed",
  "research_failed",
  "prelaunch_ready",
  "export_pdf",
  "export_csv",
  "scenario_created",
  "email_saved",
]);

export async function logEvent(db: D1Database, type: string, workspaceId: string | null, userId: string | null, data: Record<string, unknown> = {}) {
  await run(db, "INSERT INTO events (workspace_id, user_id, type, data_json) VALUES (?, ?, ?, ?)", workspaceId, userId, type, JSON.stringify(data));
}

core.get("/health", (c) => c.json({ ok: true, service: "paid-marketing-workbook", time: new Date().toISOString() }));

core.get("/config", (c) =>
  c.json({
    brandName: c.env.BRAND_NAME || "Paid Marketing Workbook",
    videoUrl: c.env.VIDEO_URL || null,
    assistEnabled: flag(c.env.ASSIST_ENABLED, true) && !!c.env.ANTHROPIC_API_KEY,
    assistConfigured: flag(c.env.ASSIST_ENABLED, true),
    researchEnabled: flag(c.env.RESEARCH_ENABLED, true),
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null,
    consentVersion: intVar(c.env.CONSENT_VERSION, 2),
    defaultCurrency: c.env.DEFAULT_CURRENCY || "AUD",
    defaultCountry: c.env.DEFAULT_COUNTRY || "AU",
  }),
);

core.use("/me", session({ create: true }));
core.use("/me/*", session({ create: true }));
core.use("/workspaces", session({ create: true }));
core.use("/workspaces/*", session({ create: true }));
core.use("/auth/magic-link", session({ create: true }));
core.use("/auth/verify", session({ create: true }));

core.get("/me", async (c) => {
  const u = c.get("user");
  const workspaces = await all(
    c.env.DB,
    "SELECT id, name, company, industry_pack, onboarding_done_at, last_section, updated_at FROM workspaces WHERE user_id = ? ORDER BY updated_at DESC",
    u.id,
  );
  return c.json({ user: { id: u.id, email: u.email, saved: isSaved(u), consentVersion: u.consent_version }, workspaces });
});

core.post("/me/consent", async (c) => {
  const body = z.object({ version: z.number().int().min(1) }).parse(await c.req.json());
  await run(c.env.DB, "UPDATE users SET consent_version = ?, consent_at = datetime('now') WHERE id = ?", body.version, c.get("user").id);
  return c.json({ ok: true });
});

/** Delete my data: cascades to workspaces, answers, ai_runs, research_runs, site_profiles and uploads. */
core.delete("/me", async (c) => {
  const u = c.get("user");
  if (c.env.UPLOADS) {
    const keys = await all<{ r2_key: string }>(c.env.DB, "SELECT r2_key FROM uploads WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = ?)", u.id);
    for (const k of keys) await c.env.UPLOADS.delete(k.r2_key);
  }
  await run(c.env.DB, "DELETE FROM events WHERE user_id = ? OR workspace_id IN (SELECT id FROM workspaces WHERE user_id = ?)", u.id, u.id);
  await run(c.env.DB, "DELETE FROM ai_runs WHERE user_id = ?", u.id);
  await run(c.env.DB, "DELETE FROM usage_counters WHERE user_id = ?", u.id);
  await run(c.env.DB, "DELETE FROM magic_links WHERE user_id = ?", u.id);
  await run(c.env.DB, "DELETE FROM users WHERE id = ?", u.id);
  setCookie(c, SESSION_COOKIE, "", { ...cookieOptions(c), maxAge: 0 });
  return c.json({ ok: true });
});

// ---------- Workspaces ----------

const WS_FIELDS = z
  .object({
    name: z.string().max(120),
    company: z.string().max(200),
    website: z.string().max(500),
    website_owner_confirmed: z.boolean(),
    no_website: z.boolean(),
    industry_pack: z.string().max(40),
    industry_text: z.string().max(200),
    offer_line: z.string().max(300),
    service_city: z.string().max(200),
    country: z.string().length(2),
    currency: z.string().length(3),
    audience_type: z.enum(["b2b", "b2c", "both"]),
    sell_mode: z.enum(["local", "online_service", "online_checkout", "national"]),
    goal: z.string().max(300),
    current_spend: z.string().max(60),
    tracking_status: z.string().max(60),
    funnel_type: z.enum(["1step", "2step", "checkout"]),
    channel: z.enum(["meta", "google"]),
    software_archetype: z.enum(["self_serve", "sales_led"]),
    onboarding_step: z.number().int().min(0).max(20),
    onboarding_done: z.boolean(),
    last_section: z.string().max(40),
  })
  .partial();

core.post("/workspaces", async (c) => {
  const u = c.get("user");
  const body = WS_FIELDS.parse(await c.req.json().catch(() => ({})));
  const id = newId("w_");
  await run(
    c.env.DB,
    "INSERT INTO workspaces (id, user_id, name, country, currency) VALUES (?, ?, ?, ?, ?)",
    id,
    u.id,
    body.name ?? "My business",
    c.env.DEFAULT_COUNTRY || "AU",
    c.env.DEFAULT_CURRENCY || "AUD",
  );
  return c.json({ id });
});

core.get("/workspaces/:id", async (c) => {
  const ws = await ownedWorkspace<Record<string, unknown>>(c, c.req.param("id"));
  if (!ws) return c.json({ error: "not_found" }, 404);
  const rows = await all<{ field_id: string; value_json: string }>(c.env.DB, "SELECT field_id, value_json FROM answers WHERE workspace_id = ?", ws.id);
  const answers: Record<string, unknown> = {};
  const origins: Record<string, string> = {};
  for (const r of rows) {
    const v = parseJson<{ value: unknown; origin?: string }>(r.value_json, { value: null });
    answers[r.field_id] = v.value;
    if (v.origin && v.origin !== "user") origins[r.field_id] = v.origin;
  }
  const site = await first<Record<string, unknown>>(c.env.DB, "SELECT domain, status, profile_json, tracking_json, ahrefs_json, error, scanned_at, confirmed_at FROM site_profiles WHERE workspace_id = ?", ws.id);
  const scenarios = await all(c.env.DB, "SELECT id, name, overrides_json, updated_at FROM scenarios WHERE workspace_id = ? ORDER BY created_at", ws.id);
  return c.json({
    workspace: { ...ws, completed_sections: parseJson<string[]>(ws.completed_sections as string, []) },
    answers,
    origins,
    site: site
      ? { ...site, profile: parseJson(site.profile_json as string, {}), tracking: parseJson(site.tracking_json as string, {}), ahrefs: parseJson(site.ahrefs_json as string, {}), profile_json: undefined, tracking_json: undefined, ahrefs_json: undefined }
      : null,
    scenarios: scenarios.map((s) => ({ ...(s as Record<string, unknown>), overrides: parseJson((s as { overrides_json: string }).overrides_json, {}) })),
  });
});

core.patch("/workspaces/:id", async (c) => {
  const ws = await ownedWorkspace<Record<string, unknown>>(c, c.req.param("id"));
  if (!ws) return c.json({ error: "not_found" }, 404);
  const body = WS_FIELDS.parse(await c.req.json());
  const sets: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    params.push(typeof v === "boolean" ? (v ? 1 : 0) : v);
  };
  for (const [k, v] of Object.entries(body)) {
    if (k === "onboarding_done") {
      if (v) sets.push("onboarding_done_at = COALESCE(onboarding_done_at, datetime('now'))");
      continue;
    }
    set(k, v);
  }
  // Industry pack sets the default funnel unless the user picked one.
  if (body.industry_pack && !body.funnel_type && !ws.funnel_type) set("funnel_type", packByKey(body.industry_pack).funnel_default);
  if (body.industry_pack && !body.audience_type && !ws.audience_type) set("audience_type", packByKey(body.industry_pack).audience_type);
  if (body.sell_mode === "online_checkout") set("funnel_type", "checkout");
  if (!sets.length) return c.json({ ok: true });
  sets.push("updated_at = datetime('now')");
  await run(c.env.DB, `UPDATE workspaces SET ${sets.join(", ")} WHERE id = ?`, ...params, ws.id);
  if (body.onboarding_step !== undefined) await logEvent(c.env.DB, "onboarding_step", ws.id as string, c.get("user").id, { step: body.onboarding_step });
  if (body.onboarding_done) await logEvent(c.env.DB, "onboarding_completed", ws.id as string, c.get("user").id);
  return c.json({ ok: true });
});

core.delete("/workspaces/:id", async (c) => {
  const ws = await ownedWorkspace(c, c.req.param("id"));
  if (!ws) return c.json({ error: "not_found" }, 404);
  await run(c.env.DB, "DELETE FROM workspaces WHERE id = ?", c.req.param("id"));
  return c.json({ ok: true });
});

// ---------- Answers ----------

const AnswerIn = z.object({
  field_id: z.string().regex(FIELD_ID),
  value: z.unknown(),
  origin: z.enum(["user", "suggestion", "edited_suggestion"]).optional(),
  suggestion_run_id: z.string().max(64).nullable().optional(),
});

core.put("/workspaces/:id/answers", async (c) => {
  const u = c.get("user");
  const ws = await ownedWorkspace<{ id: string }>(c, c.req.param("id"));
  if (!ws) return c.json({ error: "not_found" }, 404);
  if (!(await rateLimit(c.env.DB, `answers:${u.id}`, 240))) return c.json({ error: "slow_down" }, 429);
  const body = z.object({ answers: z.array(AnswerIn).max(100) }).parse(await c.req.json());
  const stmts: D1PreparedStatement[] = [];
  let channel: string | null = null;
  for (const a of body.answers) {
    const value_json = JSON.stringify({ value: a.value ?? null, origin: a.origin ?? "user", suggestion_run_id: a.suggestion_run_id ?? null });
    if (value_json.length > MAX_VALUE_BYTES) return c.json({ error: "too_large", field_id: a.field_id }, 413);
    const module = sectionForField(a.field_id)?.id ?? "other";
    if (a.value === null || a.value === undefined || a.value === "") {
      stmts.push(c.env.DB.prepare("DELETE FROM answers WHERE workspace_id = ? AND field_id = ?").bind(ws.id, a.field_id));
    } else {
      stmts.push(
        c.env.DB.prepare(
          "INSERT INTO answers (workspace_id, module, field_id, value_json, updated_at) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT(workspace_id, field_id) DO UPDATE SET value_json = excluded.value_json, module = excluded.module, updated_at = excluded.updated_at",
        ).bind(ws.id, module, a.field_id, value_json),
      );
    }
    if (a.origin === "suggestion" && a.suggestion_run_id) {
      stmts.push(c.env.DB.prepare("UPDATE ai_runs SET used = 1 WHERE id = ? AND workspace_id = ?").bind(a.suggestion_run_id, ws.id));
      stmts.push(
        c.env.DB.prepare("INSERT INTO events (workspace_id, user_id, type, data_json) VALUES (?, ?, 'assist_used', ?)").bind(ws.id, u.id, JSON.stringify({ field_id: a.field_id, run: a.suggestion_run_id })),
      );
    }
    if (a.field_id === "c3_awareness") channel = a.value === "searching" ? "google" : a.value ? "meta" : null;
    if (/^(bf_|mc_)/.test(a.field_id) && typeof a.value === "boolean")
      stmts.push(c.env.DB.prepare("INSERT INTO events (workspace_id, user_id, type, data_json) VALUES (?, ?, 'checklist_ticked', ?)").bind(ws.id, u.id, JSON.stringify({ field_id: a.field_id, value: a.value })));
  }
  if (channel) stmts.push(c.env.DB.prepare("UPDATE workspaces SET channel = ? WHERE id = ?").bind(channel, ws.id));
  stmts.push(c.env.DB.prepare("UPDATE workspaces SET updated_at = datetime('now') WHERE id = ?").bind(ws.id));
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, channel });
});

core.post("/workspaces/:id/complete", async (c) => {
  const ws = await ownedWorkspace<{ id: string; completed_sections: string }>(c, c.req.param("id"));
  if (!ws) return c.json({ error: "not_found" }, 404);
  const body = z.object({ section: z.string(), done: z.boolean() }).parse(await c.req.json());
  if (!SECTIONS.some((s) => s.id === body.section)) return c.json({ error: "bad_section" }, 400);
  const done = new Set(parseJson<string[]>(ws.completed_sections, []));
  if (body.done) done.add(body.section);
  else done.delete(body.section);
  await run(c.env.DB, "UPDATE workspaces SET completed_sections = ?, updated_at = datetime('now') WHERE id = ?", JSON.stringify([...done]), ws.id);
  if (body.done) await logEvent(c.env.DB, "section_completed", ws.id, c.get("user").id, { section: body.section });
  return c.json({ ok: true, completed: [...done] });
});

core.post("/workspaces/:id/events", async (c) => {
  const u = c.get("user");
  const ws = await ownedWorkspace<{ id: string }>(c, c.req.param("id"));
  if (!ws) return c.json({ error: "not_found" }, 404);
  if (!(await rateLimit(c.env.DB, `events:${u.id}`, 120))) return c.json({ error: "slow_down" }, 429);
  const body = z.object({ type: z.string(), data: z.record(z.string(), z.unknown()).optional() }).parse(await c.req.json());
  if (!EVENT_TYPES.has(body.type)) return c.json({ error: "bad_event" }, 400);
  await logEvent(c.env.DB, body.type, ws.id, u.id, body.data ?? {});
  return c.json({ ok: true });
});

// ---------- Scenarios (what-if; never change answers) ----------

core.post("/workspaces/:id/scenarios", async (c) => {
  const ws = await ownedWorkspace<{ id: string }>(c, c.req.param("id"));
  if (!ws) return c.json({ error: "not_found" }, 404);
  const body = z.object({ name: z.string().min(1).max(80), overrides: z.record(z.string().regex(/^fc_[a-z_]+$/), z.number().nullable()) }).parse(await c.req.json());
  const id = newId("s_");
  await run(c.env.DB, "INSERT INTO scenarios (id, workspace_id, name, overrides_json) VALUES (?, ?, ?, ?)", id, ws.id, body.name, JSON.stringify(body.overrides));
  await logEvent(c.env.DB, "scenario_created", ws.id, c.get("user").id);
  return c.json({ id });
});

core.put("/workspaces/:id/scenarios/:sid", async (c) => {
  const ws = await ownedWorkspace<{ id: string }>(c, c.req.param("id"));
  if (!ws) return c.json({ error: "not_found" }, 404);
  const body = z.object({ name: z.string().min(1).max(80), overrides: z.record(z.string().regex(/^fc_[a-z_]+$/), z.number().nullable()) }).parse(await c.req.json());
  await run(c.env.DB, "UPDATE scenarios SET name = ?, overrides_json = ?, updated_at = datetime('now') WHERE id = ? AND workspace_id = ?", body.name, JSON.stringify(body.overrides), c.req.param("sid"), ws.id);
  return c.json({ ok: true });
});

core.delete("/workspaces/:id/scenarios/:sid", async (c) => {
  const ws = await ownedWorkspace<{ id: string }>(c, c.req.param("id"));
  if (!ws) return c.json({ error: "not_found" }, 404);
  await run(c.env.DB, "DELETE FROM scenarios WHERE id = ? AND workspace_id = ?", c.req.param("sid"), ws.id);
  return c.json({ ok: true });
});

// ---------- Magic link save ----------

core.post("/auth/magic-link", async (c) => {
  const u = c.get("user");
  if (!(await rateLimit(c.env.DB, `magic:${clientIp(c)}`, 5, 600))) return c.json({ error: "slow_down" }, 429);
  const body = z.object({ email: z.email().max(200) }).parse(await c.req.json());
  const email = body.email.trim().toLowerCase();
  const token = randomToken(32);
  await run(c.env.DB, "INSERT INTO magic_links (token_hash, email, user_id, expires_at) VALUES (?, ?, ?, ?)", await sha256(token), email, u.id, addDays(1 / 48));
  const base = c.env.APP_URL || new URL(c.req.url).origin;
  const link = `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const brand = c.env.BRAND_NAME || "Paid Marketing Workbook";
  const sent = await sendEmail(c.env, email, `Open your ${brand}`, `Tap this link to open your workbook on any device:\n\n${link}\n\nThe link works for 30 minutes. If you didn't ask for this, you can ignore this email.`, link);
  return c.json({ ok: true, ...(isDev(c.env) && sent.devLink ? { devLink: sent.devLink } : {}) });
});

/** Verifies the link, merges the current browser's workspaces into the email's account, and signs in. */
core.get("/auth/verify", async (c) => {
  const token = c.req.query("token") ?? "";
  const link = await first<{ token_hash: string; email: string; user_id: string }>(
    c.env.DB,
    "SELECT token_hash, email, user_id FROM magic_links WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')",
    await sha256(token),
  );
  if (!link) return c.redirect("/?link=expired");
  await run(c.env.DB, "UPDATE magic_links SET used_at = datetime('now') WHERE token_hash = ?", link.token_hash);
  const existing = await first<{ id: string }>(c.env.DB, "SELECT id FROM users WHERE email = ?", link.email);
  const current = c.get("user");
  let target: string;
  if (existing) {
    target = existing.id;
    // Merge keeps all workspaces from both the link's browser and the current browser.
    for (const from of new Set([link.user_id, current.id])) {
      if (from !== target) {
        await run(c.env.DB, "UPDATE workspaces SET user_id = ? WHERE user_id = ?", target, from);
        await run(c.env.DB, "UPDATE ai_runs SET user_id = ? WHERE user_id = ?", target, from);
      }
    }
  } else {
    target = link.user_id;
    await run(c.env.DB, "UPDATE users SET email = ? WHERE id = ?", link.email, target);
    if (current.id !== target) await run(c.env.DB, "UPDATE workspaces SET user_id = ? WHERE user_id = ?", target, current.id);
  }
  await run(c.env.DB, "UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?", target);
  await run(c.env.DB, "DELETE FROM sessions WHERE id_hash = ?", c.get("sessionHash"));
  await createSession(c, target);
  await logEvent(c.env.DB, "email_saved", null, target);
  return c.redirect("/?saved=1");
});

core.post("/auth/logout", session({ create: false }), async (c) => {
  await run(c.env.DB, "DELETE FROM sessions WHERE id_hash = ?", c.get("sessionHash"));
  setCookie(c, SESSION_COOKIE, "", { ...cookieOptions(c), maxAge: 0 });
  return c.json({ ok: true });
});
