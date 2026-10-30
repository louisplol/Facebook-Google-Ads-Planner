import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "../env.ts";
import { first, run, parseJson } from "../lib/db.ts";
import { recordSpend } from "../assist/budget.ts";
import { loadAnswers } from "../assist/route.ts";
import { logEvent } from "../routes/core.ts";
import { CapError } from "./ahrefs.ts";
import { runRecipe, emptyTally, RECIPES, type Recipe, type Tally } from "./recipes.ts";
import { runSiteScan, type SiteProfile } from "./site-scan.ts";

// Research runs on Cloudflare Workflows so a locked phone or dropped connection doesn't kill them.
// Each stage is a durable step; the UI polls research_runs for plain progress words.

type Stepper = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

const merge = (a: Tally, b: Tally) => {
  a.units += b.units;
  a.costUsd += b.costUsd;
  a.webSearches += b.webSearches;
  a.cacheHits += b.cacheHits;
  a.browserMs += b.browserMs;
};

function friendlyError(e: unknown): string {
  if (e instanceof CapError) return "Market data has hit today's limit. Try again tomorrow.";
  return "That didn't work this time. Try again in a moment.";
}

export async function executeRun(env: Env, runId: string, step: Stepper): Promise<void> {
  const row = await first<{ id: string; workspace_id: string; recipe: string; params_json: string; status: string }>(env.DB, "SELECT id, workspace_id, recipe, params_json, status FROM research_runs WHERE id = ?", runId);
  if (!row || row.status === "done") return;
  const ws = await first<Record<string, unknown>>(env.DB, "SELECT * FROM workspaces WHERE id = ?", row.workspace_id);
  if (!ws) return;
  await run(env.DB, "UPDATE research_runs SET status = 'running' WHERE id = ?", runId);
  const tally = emptyTally();
  try {
    if (row.recipe === "site_scan") {
      const scanned = await step("Reading your website", async () => {
        await run(env.DB, "UPDATE research_runs SET step = ? WHERE id = ?", "Reading your website", runId);
        return runSiteScan(env, row.workspace_id, String(ws.website ?? ""), String(ws.country ?? "AU"));
      });
      merge(tally, { ...emptyTally(), ...scanned.tally });
      await finish(env, runId, { status: scanned.status === "failed" ? "failed" : "done", result: { status: scanned.status, message: scanned.message ?? null }, sources: [], tally, error: scanned.status === "failed" ? (scanned.message ?? "failed") : null });
      return;
    }
    if (!(RECIPES as readonly string[]).includes(row.recipe)) throw new Error("unknown recipe");
    const site = await first<{ status: string; domain: string | null; profile_json: string }>(env.DB, "SELECT status, domain, profile_json FROM site_profiles WHERE workspace_id = ?", row.workspace_id);
    const answers = await loadAnswers(env.DB, row.workspace_id);
    const out = await runRecipe(row.recipe as Recipe, {
      env,
      workspace: ws,
      answers,
      site: { status: site?.status ?? "none", domain: site?.domain ?? null, profile: site?.status === "confirmed" ? parseJson<SiteProfile | null>(site.profile_json, null) : null },
      params: parseJson(row.params_json, {}),
      stage: async (label, fn) => {
        const r = await step(label, async () => {
          await run(env.DB, "UPDATE research_runs SET step = ? WHERE id = ?", label, runId);
          const t = emptyTally();
          const value = await fn(t);
          return { value, t };
        });
        merge(tally, r.t);
        return r.value;
      },
    });
    await finish(env, runId, { status: "done", result: out.result, sources: out.sources, tally, error: null });
  } catch (e) {
    await finish(env, runId, { status: "failed", result: null, sources: [], tally, error: friendlyError(e) });
  }
}

async function finish(env: Env, runId: string, r: { status: string; result: unknown; sources: unknown[]; tally: Tally; error: string | null }) {
  await run(
    env.DB,
    `UPDATE research_runs SET status = ?, step = NULL, result_json = ?, sources_json = ?, web_searches = ?, ahrefs_units = ?, cost_usd = ?, cache_hits = ?, error = ?, finished_at = datetime('now') WHERE id = ?`,
    r.status,
    r.result === null ? null : JSON.stringify(r.result),
    JSON.stringify(r.sources),
    r.tally.webSearches,
    r.tally.units,
    r.tally.costUsd,
    r.tally.cacheHits,
    r.error,
    runId,
  );
  // Ahrefs units are recorded by the client as each call is made.
  await recordSpend(env.DB, { claude: r.tally.costUsd, webSearches: r.tally.webSearches, browserMs: r.tally.browserMs });
  const ws = await first<{ workspace_id: string; recipe: string }>(env.DB, "SELECT workspace_id, recipe FROM research_runs WHERE id = ?", runId);
  if (ws) await logEvent(env.DB, r.status === "done" ? "research_completed" : "research_failed", ws.workspace_id, null, { recipe: ws.recipe, run: runId });
}

export class ResearchWorkflow extends WorkflowEntrypoint<Env, { runId: string }> {
  override async run(event: WorkflowEvent<{ runId: string }>, step: WorkflowStep) {
    await executeRun(this.env, event.payload.runId, (name, fn) => step.do(name, fn as () => Promise<never>) as Promise<never>);
  }
}

/** Local fallback when the Workflow binding isn't available: same stages, run in place. */
export function runRecipeInline(env: Env, runId: string): Promise<void> {
  return executeRun(env, runId, (_name, fn) => fn());
}
