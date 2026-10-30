import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { app } from "../src/index.ts";
import { testEnv, client, readSse } from "../../test/helpers.ts";
import { setLlmForTests, type LlmClient, type LlmCall } from "../src/assist/llm.ts";
import { validateOutput } from "../src/assist/validate.ts";
import { dailyJobs } from "../src/cron.ts";
import type { Env } from "../src/env.ts";

async function setup(over: Partial<Env> = {}) {
  const env = testEnv(over);
  const c = client(app, env);
  await c.get("/api/me");
  const { id } = (await (await c.post("/api/workspaces", { name: "Test" })).json()) as { id: string };
  return { env, c, ws: id };
}

describe("health and config", () => {
  it("serves health", async () => {
    const env = testEnv();
    const r = await app.request("http://localhost/api/health", {}, env);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true });
  });
  it("config never leaks keys", async () => {
    const env = testEnv({ ANTHROPIC_API_KEY: "sk-secret", AHREFS_API_KEY: "ah-secret", BRAND_NAME: "My Brand" });
    const text = await (await app.request("http://localhost/api/config", {}, env)).text();
    expect(text).not.toContain("secret");
    expect(JSON.parse(text).brandName).toBe("My Brand");
  });
});

describe("persistence", () => {
  it("answers survive a reload, with origin", async () => {
    const { c, ws } = await setup();
    await c.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "msg_thing", value: "A workshop" }, { field_id: "fc_daily_budget", value: 50 }, { field_id: "msg_result", value: "Booked out", origin: "suggestion", suggestion_run_id: "r_x" }] });
    const data = (await (await c.get(`/api/workspaces/${ws}`)).json()) as { answers: Record<string, unknown>; origins: Record<string, string> };
    expect(data.answers).toMatchObject({ msg_thing: "A workshop", fc_daily_budget: 50, msg_result: "Booked out" });
    expect(data.origins).toEqual({ msg_result: "suggestion" });
  });
  it("empty value deletes the answer", async () => {
    const { c, ws } = await setup();
    await c.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "msg_thing", value: "x" }] });
    await c.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "msg_thing", value: "" }] });
    const data = (await (await c.get(`/api/workspaces/${ws}`)).json()) as { answers: Record<string, unknown> };
    expect(data.answers.msg_thing).toBeUndefined();
  });
  it("the 3 C's answer sets the channel", async () => {
    const { c, ws } = await setup();
    const r = (await (await c.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "c3_awareness", value: "searching" }] })).json()) as { channel: string };
    expect(r.channel).toBe("google");
  });
  it("industry pack sets the default funnel; resume step is kept", async () => {
    const { c, ws } = await setup();
    await c.patch(`/api/workspaces/${ws}`, { industry_pack: "trades", onboarding_step: 3 });
    const { workspace } = (await (await c.get(`/api/workspaces/${ws}`)).json()) as { workspace: Record<string, unknown> };
    expect(workspace).toMatchObject({ funnel_type: "1step", audience_type: "b2c", onboarding_step: 3 });
  });
  it("another visitor can't read or write my workspace", async () => {
    const { env, ws } = await setup();
    const other = client(app, env);
    await other.get("/api/me");
    expect((await other.get(`/api/workspaces/${ws}`)).status).toBe(404);
    expect((await other.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "msg_thing", value: "x" }] })).status).toBe(404);
  });
  it("rejects bad field ids", async () => {
    const { c, ws } = await setup();
    expect((await c.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "Bad Id; drop", value: "x" }] })).status).toBe(400);
  });
  it("section completion", async () => {
    const { c, ws } = await setup();
    const r = (await (await c.post(`/api/workspaces/${ws}/complete`, { section: "messaging", done: true })).json()) as { completed: string[] };
    expect(r.completed).toEqual(["messaging"]);
    expect((await c.post(`/api/workspaces/${ws}/complete`, { section: "nope", done: true })).status).toBe(400);
  });
  it("events are whitelisted", async () => {
    const { c, ws } = await setup();
    expect((await c.post(`/api/workspaces/${ws}/events`, { type: "section_viewed", data: { section: "x" } })).status).toBe(200);
    expect((await c.post(`/api/workspaces/${ws}/events`, { type: "anything" })).status).toBe(400);
  });
});

describe("scenarios", () => {
  it("scenario overrides never change answers", async () => {
    const { c, ws } = await setup();
    await c.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "fc_daily_budget", value: 50 }] });
    const { id } = (await (await c.post(`/api/workspaces/${ws}/scenarios`, { name: "Double", overrides: { fc_daily_budget: 100 } })).json()) as { id: string };
    await c.put(`/api/workspaces/${ws}/scenarios/${id}`, { name: "Triple", overrides: { fc_daily_budget: 150 } });
    const data = (await (await c.get(`/api/workspaces/${ws}`)).json()) as { answers: Record<string, unknown>; scenarios: { name: string; overrides: Record<string, number> }[] };
    expect(data.answers.fc_daily_budget).toBe(50);
    expect(data.scenarios).toMatchObject([{ name: "Triple", overrides: { fc_daily_budget: 150 } }]);
    await c.del(`/api/workspaces/${ws}/scenarios/${id}`);
    expect(((await (await c.get(`/api/workspaces/${ws}`)).json()) as { scenarios: unknown[] }).scenarios).toEqual([]);
  });
  it("only forecast fields can be overridden", async () => {
    const { c, ws } = await setup();
    expect((await c.post(`/api/workspaces/${ws}/scenarios`, { name: "x", overrides: { msg_thing: 1 } })).status).toBe(400);
  });
});

describe("magic link save", () => {
  it("merge keeps all workspaces", async () => {
    const env = testEnv();
    // Device A saves with an email
    const a = client(app, env);
    await a.get("/api/me");
    await a.post("/api/workspaces", { name: "A1" });
    const linkA = ((await (await a.post("/api/auth/magic-link", { email: "Owner@Example.com" })).json()) as { devLink: string }).devLink;
    const vA = await a.get(new URL(linkA).pathname + new URL(linkA).search);
    expect(vA.status).toBe(302);
    expect(vA.headers.get("location")).toBe("/?saved=1");
    // Device B has its own workspace, then signs in with the same email
    const b = client(app, env);
    await b.get("/api/me");
    await b.post("/api/workspaces", { name: "B1" });
    const linkB = ((await (await b.post("/api/auth/magic-link", { email: "owner@example.com" })).json()) as { devLink: string }).devLink;
    await b.get(new URL(linkB).pathname + new URL(linkB).search);
    const me = (await (await b.get("/api/me")).json()) as { user: { saved: boolean; email: string }; workspaces: { name: string }[] };
    expect(me.user).toMatchObject({ saved: true, email: "owner@example.com" });
    expect(me.workspaces.map((w) => w.name).sort()).toEqual(["A1", "B1"]);
  });
  it("links work once", async () => {
    const { c } = await setup();
    const link = ((await (await c.post("/api/auth/magic-link", { email: "x@example.com" })).json()) as { devLink: string }).devLink;
    const path = new URL(link).pathname + new URL(link).search;
    await c.get(path);
    expect((await c.get(path)).headers.get("location")).toBe("/?link=expired");
  });
  it("delete my data removes everything", async () => {
    const { env, c, ws } = await setup();
    await c.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "msg_thing", value: "x" }] });
    expect((await c.del("/api/me")).status).toBe(200);
    const left = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM workspaces) + (SELECT COUNT(*) FROM answers) + (SELECT COUNT(*) FROM users) AS n").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});

// ---------- Assist layer (mocked Claude; no live calls) ----------

class MockLlm implements LlmClient {
  calls: LlmCall[] = [];
  constructor(private respond: (call: LlmCall, n: number) => unknown) {}
  async structured(call: LlmCall) {
    this.calls.push(call);
    return { data: this.respond(call, this.calls.length), usage: { input_tokens: 3000, output_tokens: 500, cache_read_input_tokens: 0 }, stopReason: "end_turn" };
  }
  async toolLoop(): Promise<never> {
    throw new Error("not used");
  }
}

describe("assist", () => {
  afterEach(() => setLlmForTests(null));

  it("suggest returns options, records the run and spend, and strips dashes", async () => {
    const mock = new MockLlm(() => ({ options: [{ text: "Booked out — finally", note: "from your pains", from: "av_away_1" }] }));
    setLlmForTests(mock);
    const { env, c, ws } = await setup({ ANTHROPIC_API_KEY: "test" });
    await c.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "av_away_1", value: "Word of mouth plateauing" }, { field_id: "sa_agenda", value: "secret agenda" }] });
    const res = await c.post("/api/assist", { workspace_id: ws, field_id: "msg_headline_1", action: "suggest", text: "" });
    const events = await readSse(res);
    const result = events.find((e) => e.event === "result")!;
    expect(result.data.output.options[0].text).toBe("Booked out, finally");
    expect(mock.calls[0].user).toContain("Word of mouth plateauing");
    expect(mock.calls[0].user).not.toContain("secret agenda");
    expect(mock.calls[0].model).toBe("claude-sonnet-5-5");
    const run = await env.DB.prepare("SELECT action, cost_usd, used FROM ai_runs").first<{ action: string; cost_usd: number; used: number }>();
    expect(run).toMatchObject({ action: "suggest", used: 0 });
    expect(run!.cost_usd).toBeCloseTo(0.011, 6);
    // Using it marks the run as used
    await c.put(`/api/workspaces/${ws}/answers`, { answers: [{ field_id: "msg_headline_1", value: "Booked out, finally", origin: "suggestion", suggestion_run_id: result.data.run_id }] });
    expect((await env.DB.prepare("SELECT used FROM ai_runs").first<{ used: number }>())?.used).toBe(1);
  });

  it("a booking CTA in a script is rejected, retried, then a plain error", async () => {
    const mock = new MockLlm(() => ({ hook: "h", prove: "p", cta: "Book a call today", shotNotes: "" }));
    setLlmForTests(mock);
    const { c, ws } = await setup({ ANTHROPIC_API_KEY: "test" });
    const events = await readSse(await c.post("/api/assist", { workspace_id: ws, field_id: "fa_scripts", action: "script_idea", text: "idea" }));
    expect(mock.calls).toHaveLength(2);
    expect(events.at(-1)?.event).toBe("error");
    expect(events.at(-1)?.data.message).not.toMatch(/token|API|Claude/);
  });

  it("validators: em dash swapped, booking CTA fails, SMS limit, google limits", () => {
    expect(validateOutput("suggest", "msg_thing", { options: [{ text: "a — b", note: "", from: "" }] }).output).toEqual({ options: [{ text: "a, b", note: "", from: "" }] });
    expect(validateOutput("script_idea", "fa_scripts", { hook: "", prove: "", cta: "Call us now", shotNotes: "" }).ok).toBe(false);
    expect(validateOutput("script_idea", "fa_scripts", { hook: "", prove: "", cta: "Click below to learn more.", shotNotes: "" }).ok).toBe(true);
    expect(validateOutput("write_message", "bf_nurture_1", { channel: "sms", subject: "", body: "x".repeat(200) }).ok).toBe(false);
    const g = validateOutput("suggest", "gs_headlines", { options: [{ text: "Short one", note: "", from: "" }, { text: "x".repeat(40), note: "", from: "" }] });
    expect((g.output as { options: unknown[] }).options).toHaveLength(1);
    expect(validateOutput("suggest", "gs_headlines", { options: [{ text: "x".repeat(40), note: "", from: "" }] }).ok).toBe(false);
    expect(validateOutput("suggest", "msg_thing", { options: [{ text: "Guaranteed results", note: "", from: "" }] }).flags.map((f) => f.id)).toContain("guarantee");
  });

  it("budget stop pauses assists", async () => {
    setLlmForTests(new MockLlm(() => ({ options: [] })));
    const { env, c, ws } = await setup({ ANTHROPIC_API_KEY: "test", AI_MONTHLY_BUDGET_USD: "1" });
    await env.DB.prepare("INSERT INTO spend_daily (day, claude_cost_usd) VALUES (?, 1.5)").bind(new Date().toISOString().slice(0, 10)).run();
    const r = await c.post("/api/assist", { workspace_id: ws, field_id: "msg_thing", action: "suggest" });
    expect(r.status).toBe(503);
    expect(((await r.json()) as { message: string }).message).toBe("Busy today, try again tomorrow.");
  });

  it("ASSIST_ENABLED=false switches assists off", async () => {
    const { c, ws } = await setup({ ANTHROPIC_API_KEY: "test", ASSIST_ENABLED: "false" });
    expect((await c.post("/api/assist", { workspace_id: ws, field_id: "msg_thing", action: "suggest" })).status).toBe(503);
    const cfg = (await (await c.get("/api/config")).json()) as { assistEnabled: boolean };
    expect(cfg.assistEnabled).toBe(false);
  });

  it("no general chat: unknown field and action pairs are refused", async () => {
    setLlmForTests(new MockLlm(() => ({ options: [] })));
    const { c, ws } = await setup({ ANTHROPIC_API_KEY: "test" });
    expect((await c.post("/api/assist", { workspace_id: ws, field_id: "msg_thing", action: "practice_call" })).status).toBe(400);
    expect((await c.post("/api/assist", { workspace_id: ws, field_id: "chat", action: "suggest" })).status).toBe(400);
  });

  it("daily allowance for visitors", async () => {
    setLlmForTests(new MockLlm(() => ({ options: [] })));
    const { c, ws } = await setup({ ANTHROPIC_API_KEY: "test", ASSIST_DAILY_ANON: "1" });
    await readSse(await c.post("/api/assist", { workspace_id: ws, field_id: "msg_thing", action: "suggest" }));
    expect((await c.post("/api/assist", { workspace_id: ws, field_id: "msg_thing", action: "suggest" })).status).toBe(429);
  });

  it("practice call needs a saved email", async () => {
    setLlmForTests(new MockLlm(() => ({ reply: "hi", done: false, feedback: [] })));
    const { c, ws } = await setup({ ANTHROPIC_API_KEY: "test" });
    expect((await c.post("/api/assist", { workspace_id: ws, field_id: "sa_practice", action: "practice_call" })).status).toBe(403);
  });

  it("explain forecast gets the engine's numbers, not raw maths", async () => {
    const mock = new MockLlm(() => ({ text: "Your opt-in is the dial." }));
    setLlmForTests(mock);
    const { c, ws } = await setup({ ANTHROPIC_API_KEY: "test" });
    await c.put(`/api/workspaces/${ws}/answers`, {
      answers: Object.entries({ fc_daily_budget: 50, fc_offer_price: 2500, fc_cpm: 40, fc_ctr: 0.01, fc_optin: 0.07, fc_booking: 0.3, fc_show: 0.7, fc_close: 0.3 }).map(([field_id, value]) => ({ field_id, value })),
    });
    await readSse(await c.post("/api/assist", { workspace_id: ws, field_id: "fc_explain", action: "explain_forecast" }));
    expect(mock.calls[0].user).toContain("engine.biggest_dial");
    expect(mock.calls[0].user).toContain("Opt-in Rate");
    expect(mock.calls[0].model).toBe("claude-haiku-5-5");
  });

  it("not connected without a key", async () => {
    const { c, ws } = await setup();
    expect((await c.post("/api/assist", { workspace_id: ws, field_id: "msg_thing", action: "suggest" })).status).toBe(503);
  });
});

describe("admin", () => {
  let env: Env;
  beforeEach(() => {
    env = testEnv({ ADMIN_DEV_TOKEN: "a-long-local-admin-token", ADMIN_EMAILS: "owner@example.com" });
  });
  it("no Access JWT returns 403", async () => {
    for (const p of ["overview", "activity", "funnel", "workspaces", "assists", "research", "spend", "insights"]) {
      expect((await app.request(`http://localhost/api/admin/${p}`, {}, env)).status, p).toBe(403);
    }
  });
  it("a forged JWT is refused", async () => {
    const forged = ["eyJhbGciOiJSUzI1NiIsImtpZCI6IngifQ", btoa(JSON.stringify({ email: "owner@example.com", aud: "x", exp: 9999999999 })), "sig"].join(".");
    const prod = testEnv({ ENVIRONMENT: "production", ACCESS_TEAM_DOMAIN: "team", ACCESS_AUD: "x", ADMIN_EMAILS: "owner@example.com" });
    expect((await app.request("http://localhost/api/admin/overview", { headers: { "cf-access-jwt-assertion": forged } }, prod)).status).toBe(403);
  });
  it("the dev token never works in production", async () => {
    const prod = testEnv({ ENVIRONMENT: "production", ADMIN_DEV_TOKEN: "a-long-local-admin-token" });
    expect((await app.request("http://localhost/api/admin/overview", { headers: { "x-admin-token": "a-long-local-admin-token" } }, prod)).status).toBe(403);
  });
  it("all pages render with seed data including ai_runs, and views are audited", async () => {
    const c = client(app, env);
    await c.get("/api/me");
    const { id } = (await (await c.post("/api/workspaces", { name: "Seed" })).json()) as { id: string };
    await c.patch(`/api/workspaces/${id}`, { industry_pack: "trades", onboarding_done: true });
    await c.put(`/api/workspaces/${id}/answers`, { answers: [{ field_id: "av_away_1", value: "No-shows" }] });
    await env.DB.prepare("INSERT INTO ai_runs (id, workspace_id, user_id, section, field_id, action, model, cost_usd, used, output_json) VALUES ('r1', ?, 'u', 'messaging', 'msg_thing', 'suggest', 'claude-sonnet-5-5', 0.01, 1, '{}')").bind(id).run();
    await env.DB.prepare("INSERT INTO research_runs (id, workspace_id, recipe, status, result_json) VALUES ('rr1', ?, 'search_demand', 'done', '{\"terms\":[{\"keyword\":\"electrician\",\"volume\":100}]}')").bind(id).run();
    const h = { "x-admin-token": "a-long-local-admin-token" };
    for (const p of ["overview", "activity", "funnel", "workspaces", `workspaces/${id}`, "assists", "research", "spend", "insights", "whoami"]) {
      const r = await app.request(`http://localhost/api/admin/${p}`, { headers: h }, env);
      expect(r.status, p).toBe(200);
    }
    const ins = (await (await app.request("http://localhost/api/admin/insights", { headers: h }, env)).json()) as { insights: { pains: { text: string }[] }[]; keywords: { keyword: string }[] };
    expect(ins.insights[0].pains[0].text).toBe("No-shows");
    expect(ins.keywords[0].keyword).toBe("electrician");
    const audits = await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit").first<{ n: number }>();
    expect(audits?.n).toBeGreaterThanOrEqual(10);
  });
});

describe("daily jobs", () => {
  it("alerts at 80% of budget", async () => {
    const env = testEnv({ AI_MONTHLY_BUDGET_USD: "10" });
    await env.DB.prepare("INSERT INTO spend_daily (day, claude_cost_usd, ahrefs_units) VALUES (?, 8.5, 4500)").bind(new Date().toISOString().slice(0, 10)).run();
    const r = await dailyJobs(env);
    expect(r.alerts).toHaveLength(2);
  });
});
