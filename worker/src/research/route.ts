import { Hono, type Context } from "hono";
import { z } from "zod";
import type { TrackingResult } from "@pmw/engine";
import type { AppEnv } from "../lib/session.ts";
import { session, isSaved } from "../lib/session.ts";
import { first, newId, run, parseJson, addDays } from "../lib/db.ts";
import { ownedWorkspace, rateLimit, clientIp, verifyTurnstile } from "../lib/guards.ts";
import { flag } from "../env.ts";
import { allowance, bumpUsage, usageToday, overBudget } from "../assist/budget.ts";
import { logEvent } from "../routes/core.ts";
import { RECIPES } from "./recipes.ts";
import { runRecipeInline } from "./workflow.ts";
import { readPage, checkPublicUrl, FetchRefused } from "./fetcher.ts";
import { normaliseDomain } from "./site-scan.ts";

export const research = new Hono<AppEnv>();

for (const p of ["/site-scan", "/site-scan/*", "/research/*", "/uploads", "/page-check/*"]) research.use(p, session({ create: false }));

const WsIn = z.object({ workspace_id: z.string().max(64) });

/** Turnstile once per session, when a secret is configured. */
async function turnstileOk(c: Context<AppEnv>, token: string | undefined): Promise<boolean> {
  if (!c.env.TURNSTILE_SECRET_KEY) return true;
  const s = await first<{ turnstile_ok_at: string | null }>(c.env.DB, "SELECT turnstile_ok_at FROM sessions WHERE id_hash = ?", c.get("sessionHash"));
  if (s?.turnstile_ok_at) return true;
  if (!(await verifyTurnstile(c.env, token, clientIp(c)))) return false;
  await run(c.env.DB, "UPDATE sessions SET turnstile_ok_at = datetime('now') WHERE id_hash = ?", c.get("sessionHash"));
  return true;
}

async function startRun(c: Context<AppEnv>, workspaceId: string, recipe: string, params: Record<string, unknown>): Promise<string> {
  const runId = newId("rr_");
  await run(c.env.DB, "INSERT INTO research_runs (id, workspace_id, recipe, status, params_json) VALUES (?, ?, ?, 'queued', ?)", runId, workspaceId, recipe, JSON.stringify(params));
  let started = false;
  if (c.env.RESEARCH_WORKFLOW) {
    try {
      await c.env.RESEARCH_WORKFLOW.create({ id: runId, params: { runId } });
      started = true;
    } catch {
      // fall back to running in place
    }
  }
  if (!started) c.executionCtx.waitUntil(runRecipeInline(c.env, runId));
  return runId;
}

// ---------- Website scan ----------

research.post("/site-scan", async (c) => {
  const body = WsIn.extend({ turnstile_token: z.string().max(4096).optional() }).parse(await c.req.json());
  const ws = await ownedWorkspace<{ id: string; website: string | null; website_owner_confirmed: number; country: string }>(c, body.workspace_id);
  if (!ws) return c.json({ error: "not_found" }, 404);
  if (!flag(c.env.RESEARCH_ENABLED, true)) return c.json({ error: "off", message: "Website scans are switched off right now. You can fill in your details yourself." }, 503);
  if (!ws.website || !ws.website_owner_confirmed) return c.json({ error: "website_needed", message: "Add your website and tick that it's yours." }, 400);
  const n = normaliseDomain(ws.website);
  if (!n) return c.json({ error: "bad_website", message: "That doesn't look like a website address." }, 400);
  try {
    await checkPublicUrl(n.home);
  } catch {
    return c.json({ error: "bad_website", message: "That doesn't look like a public website address." }, 400);
  }
  const existing = await first<{ status: string; scanned_at: string | null }>(c.env.DB, "SELECT status, scanned_at FROM site_profiles WHERE workspace_id = ?", ws.id);
  if (existing?.status === "scanning") return c.json({ status: "scanning" });
  if (existing && existing.status !== "failed" && existing.status !== "no_website" && existing.scanned_at) {
    const recent = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM site_profiles WHERE workspace_id = ? AND scanned_at > datetime('now', '-1 day')", ws.id);
    if (recent?.n) return c.json({ error: "scan_again_tomorrow", message: "You can scan again tomorrow." }, 429);
  }
  if (!(await turnstileOk(c, body.turnstile_token))) return c.json({ error: "turnstile", message: "Please confirm you're a person first." }, 403);
  if (!(await rateLimit(c.env.DB, `scan:${clientIp(c)}`, 3, 86400))) return c.json({ error: "slow_down", message: "That's a few scans today. Try again tomorrow." }, 429);
  if (await overBudget(c.env)) return c.json({ error: "busy", message: "Busy today, try again tomorrow." }, 503);
  await run(
    c.env.DB,
    "INSERT INTO site_profiles (workspace_id, domain, status) VALUES (?, ?, 'scanning') ON CONFLICT(workspace_id) DO UPDATE SET domain = excluded.domain, status = 'scanning', error = NULL, confirmed_at = NULL",
    ws.id,
    n.domain,
  );
  const runId = await startRun(c, ws.id, "site_scan", {});
  return c.json({ run_id: runId, status: "scanning" });
});

research.get("/site-scan", async (c) => {
  const ws = await ownedWorkspace<{ id: string }>(c, c.req.query("workspace_id") ?? "");
  if (!ws) return c.json({ error: "not_found" }, 404);
  const s = await first<Record<string, string | null>>(c.env.DB, "SELECT domain, status, pages_json, profile_json, tracking_json, ahrefs_json, error, scanned_at, confirmed_at FROM site_profiles WHERE workspace_id = ?", ws.id);
  if (!s) return c.json({ status: "none" });
  return c.json({
    domain: s.domain,
    status: s.status,
    error: s.error,
    scanned_at: s.scanned_at,
    confirmed_at: s.confirmed_at,
    pages: parseJson(s.pages_json, []),
    profile: parseJson(s.profile_json, {}),
    tracking: parseJson(s.tracking_json, {}),
    ahrefs: parseJson(s.ahrefs_json, {}),
  });
});

research.post("/site-scan/confirm", async (c) => {
  const body = WsIn.extend({ profile: z.record(z.string(), z.unknown()) }).parse(await c.req.json());
  const ws = await ownedWorkspace<{ id: string }>(c, body.workspace_id);
  if (!ws) return c.json({ error: "not_found" }, 404);
  const s = await first<{ status: string }>(c.env.DB, "SELECT status FROM site_profiles WHERE workspace_id = ?", ws.id);
  if (!s || (s.status !== "needs_confirm" && s.status !== "confirmed")) return c.json({ error: "nothing_to_confirm" }, 409);
  const profile = JSON.stringify(body.profile);
  if (profile.length > 64 * 1024) return c.json({ error: "too_large" }, 413);
  await run(c.env.DB, "UPDATE site_profiles SET profile_json = ?, status = 'confirmed', confirmed_at = datetime('now') WHERE workspace_id = ?", profile, ws.id);
  return c.json({ ok: true, status: "confirmed" });
});

research.post("/site-scan/no-website", async (c) => {
  const body = WsIn.parse(await c.req.json());
  const ws = await ownedWorkspace<{ id: string }>(c, body.workspace_id);
  if (!ws) return c.json({ error: "not_found" }, 404);
  await run(
    c.env.DB,
    "INSERT INTO site_profiles (workspace_id, domain, status, confirmed_at) VALUES (?, NULL, 'no_website', datetime('now')) ON CONFLICT(workspace_id) DO UPDATE SET status = 'no_website', domain = NULL, confirmed_at = datetime('now')",
    ws.id,
  );
  await run(c.env.DB, "UPDATE workspaces SET no_website = 1, updated_at = datetime('now') WHERE id = ?", ws.id);
  return c.json({ ok: true, status: "no_website" });
});

// ---------- Research recipes ----------

research.post("/research/:recipe", async (c) => {
  const env = c.env;
  const u = c.get("user");
  if (!flag(env.RESEARCH_ENABLED, true)) return c.json({ error: "off", message: "Market research is switched off right now." }, 503);
  const recipe = c.req.param("recipe");
  if (!(RECIPES as readonly string[]).includes(recipe)) return c.json({ error: "unknown_recipe" }, 400);
  const body = WsIn.extend({ params: z.record(z.string(), z.unknown()).optional(), turnstile_token: z.string().max(4096).optional() }).parse(await c.req.json());
  const ws = await ownedWorkspace<{ id: string }>(c, body.workspace_id);
  if (!ws) return c.json({ error: "not_found" }, 404);
  if (!isSaved(u)) return c.json({ error: "save_first", message: "Add your email to use market research." }, 403);
  if (!(await turnstileOk(c, body.turnstile_token))) return c.json({ error: "turnstile", message: "Please confirm you're a person first." }, 403);
  const site = await first<{ status: string }>(env.DB, "SELECT status FROM site_profiles WHERE workspace_id = ?", ws.id);
  if (site?.status !== "confirmed" && site?.status !== "no_website")
    return c.json({ error: "scan_first", message: "Confirm what we found on your website first, or tell us you don't have one yet." }, 409);
  if ((await usageToday(env.DB, u.id, "research")) >= allowance(env, "research", true)) return c.json({ error: "allowance", message: "You've used today's research. Try again tomorrow." }, 429);
  if (await overBudget(env)) return c.json({ error: "busy", message: "Busy today, try again tomorrow." }, 503);
  const params = body.params ?? {};
  if (JSON.stringify(params).length > 8000) return c.json({ error: "too_large" }, 413);
  await bumpUsage(env.DB, u.id, "research");
  await logEvent(env.DB, "research_started", ws.id, u.id, { recipe });
  const runId = await startRun(c, ws.id, recipe, params);
  return c.json({ run_id: runId });
});

const runView = (r: Record<string, unknown>) => ({
  id: r.id,
  recipe: r.recipe,
  status: r.status,
  step: r.step,
  error: r.error,
  result: parseJson(r.result_json as string, null),
  sources: parseJson(r.sources_json as string, []),
  started_at: r.started_at,
  finished_at: r.finished_at,
});

research.get("/research/runs/:id", async (c) => {
  const r = await first<Record<string, unknown>>(
    c.env.DB,
    "SELECT r.* FROM research_runs r JOIN workspaces w ON w.id = r.workspace_id WHERE r.id = ? AND w.user_id = ?",
    c.req.param("id"),
    c.get("user").id,
  );
  if (!r) return c.json({ error: "not_found" }, 404);
  return c.json(runView(r));
});

research.get("/research/latest", async (c) => {
  const ws = await ownedWorkspace<{ id: string }>(c, c.req.query("workspace_id") ?? "");
  if (!ws) return c.json({ error: "not_found" }, 404);
  const recipe = c.req.query("recipe") ?? "";
  const r = await first<Record<string, unknown>>(c.env.DB, "SELECT * FROM research_runs WHERE workspace_id = ? AND recipe = ? ORDER BY started_at DESC, rowid DESC LIMIT 1", ws.id, recipe);
  return c.json({ run: r ? runView(r) : null });
});

// ---------- Uploads (short lived) ----------

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

research.post("/uploads", async (c) => {
  if (!c.env.UPLOADS) return c.json({ error: "not_connected", message: "Uploads aren't set up yet." }, 503);
  const form = await c.req.parseBody();
  const file = form.file;
  const kind = String(form.kind ?? "");
  const ws = await ownedWorkspace<{ id: string }>(c, String(form.workspace_id ?? ""));
  if (!ws) return c.json({ error: "not_found" }, 404);
  if (!(file instanceof File)) return c.json({ error: "no_file", message: "Choose a file to upload." }, 400);
  if (!(await rateLimit(c.env.DB, `upload:${c.get("user").id}`, 20, 3600))) return c.json({ error: "slow_down" }, 429);
  if (kind === "ad_screenshot") {
    if (!IMAGE_TYPES.has(file.type)) return c.json({ error: "bad_type", message: "Use a PNG, JPEG or WebP image." }, 400);
    if (file.size > 5 * 1024 * 1024) return c.json({ error: "too_large", message: "Images must be 5 MB or smaller." }, 413);
  } else if (kind === "csv") {
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") return c.json({ error: "bad_type", message: "Use a CSV file." }, 400);
    if (file.size > 2 * 1024 * 1024) return c.json({ error: "too_large", message: "CSV files must be 2 MB or smaller." }, 413);
  } else return c.json({ error: "bad_kind" }, 400);
  const id = newId("up_");
  const key = `uploads/${ws.id}/${id}`;
  await c.env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || (kind === "csv" ? "text/csv" : "image/png") } });
  await run(c.env.DB, "INSERT INTO uploads (id, workspace_id, r2_key, kind, expires_at) VALUES (?, ?, ?, ?, ?)", id, ws.id, key, kind, addDays(7));
  return c.json({ id, kind });
});

// ---------- Check tracking ----------

const NOT_FOUND = "not found; check with Meta Pixel Helper";

research.post("/page-check/tracking", async (c) => {
  const body = WsIn.extend({ urls: z.object({ application: z.string().max(500).optional(), booking: z.string().max(500).optional(), thankyou: z.string().max(500).optional() }) }).parse(await c.req.json());
  const ws = await ownedWorkspace<{ id: string }>(c, body.workspace_id);
  if (!ws) return c.json({ error: "not_found" }, 404);
  if (!(await rateLimit(c.env.DB, `track:${c.get("user").id}`, 10, 3600))) return c.json({ error: "slow_down", message: "Try again in a little while." }, 429);
  const entries = Object.entries(body.urls).filter(([, v]) => v && v.trim()) as [string, string][];
  if (!entries.length) return c.json({ error: "no_urls", message: "Add at least one page link." }, 400);
  const hasBooking = !!body.urls.booking?.trim();
  // Lead fires after a qualifying form: on the booking page (2-step) or the thank you page (1-step).
  const leadPage = hasBooking ? "booking" : "thankyou";
  const pages: TrackingResult["pages"] = {};
  for (const [name, url] of entries) {
    try {
      const p = await readPage(c.env, url.trim(), { render: true });
      const notes: string[] = [];
      if (!p.tracking.metaPixel) notes.push(`Pixel ${NOT_FOUND}`);
      const wantLead = name === leadPage;
      const wantSchedule = hasBooking && name === "thankyou";
      if (wantLead && !p.tracking.leadEvent) notes.push(`Lead event ${NOT_FOUND}`);
      if (wantSchedule && !p.tracking.scheduleEvent) notes.push(`Schedule event ${NOT_FOUND}`);
      pages[name] = {
        pixel: p.tracking.metaPixel ? true : null,
        lead: wantLead ? (p.tracking.leadEvent ? true : null) : null,
        schedule: wantSchedule ? (p.tracking.scheduleEvent ? true : null) : null,
        ...(notes.length ? { note: notes.join(". ") } : {}),
      };
    } catch (e) {
      pages[name] = { pixel: null, lead: null, schedule: null, note: e instanceof FetchRefused ? "That page address can't be read." : "We couldn't open this page." };
    }
  }
  const passed = Object.entries(pages).every(([name, p]) => p.pixel === true && (name !== leadPage || p.lead === true) && (!(hasBooking && name === "thankyou") || p.schedule === true));
  const result: TrackingResult = { checkedAt: new Date().toISOString(), passed, pages };
  await run(
    c.env.DB,
    "INSERT INTO answers (workspace_id, module, field_id, value_json, updated_at) VALUES (?, 'landing-page', 'lp_tracking', ?, datetime('now')) ON CONFLICT(workspace_id, field_id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
    ws.id,
    JSON.stringify({ value: result, origin: "user", suggestion_run_id: null }),
  );
  return c.json(result);
});
