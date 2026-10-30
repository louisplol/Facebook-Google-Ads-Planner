import { describe, it, expect } from "vitest";
import { replaceDashes, hasDash, checkAdCta, scriptAsksForBooking, checkGoogleHeadline, checkGoogleDescription, checkSms, checkFormOrder, complianceFlags, copyProblems } from "../src/validate/index.ts";
import { prelaunchCheck } from "../src/plan/prelaunch.ts";
import { contextKeys, buildContext } from "../src/ai/context-map.ts";
import { costUsd, MODELS } from "../src/ai/models.ts";
import { ACTION_SPEC, jsonSchemaFor, OptionsOut } from "../src/ai/schemas.ts";
import { taskFor } from "../src/ai/tasks.ts";

describe("validators", () => {
  it("replaces em and en dashes", () => {
    expect(replaceDashes("Fast — and friendly")).toBe("Fast, and friendly");
    expect(replaceDashes("5–10 minutes")).toBe("5-10 minutes");
    expect(replaceDashes("Booked out – finally")).toBe("Booked out, finally");
    expect(replaceDashes("a–b")).toBe("a-b");
    expect(hasDash(replaceDashes("x — y – z"))).toBe(false);
  });
  it("rejects a booking CTA", () => {
    expect(checkAdCta("Book a call today").ok).toBe(false);
    expect(checkAdCta("Call us now").ok).toBe(false);
    expect(checkAdCta("Click below to learn more.").ok).toBe(true);
    expect(checkAdCta("Click below to see if you’re a good fit!").ok).toBe(true);
    expect(checkAdCta("").ok).toBe(false);
    expect(checkAdCta("Visit our website").ok).toBe(false);
    expect(scriptAsksForBooking("So book now and save")).toBe(true);
  });
  it("google limits", () => {
    expect(checkGoogleHeadline("Emergency Electrician Perth").ok).toBe(true);
    expect(checkGoogleHeadline("This headline is far too long for Google").ok).toBe(false);
    expect(checkGoogleDescription("x".repeat(91)).ok).toBe(false);
    expect(checkGoogleDescription("x".repeat(90)).ok).toBe(true);
  });
  it("sms within one segment", () => {
    expect(checkSms("Hi {first_name}, you're booked for {call_time}. Reply YES to confirm.").ok).toBe(true);
    expect(checkSms("x".repeat(161)).ok).toBe(false);
  });
  it("form order: contact last", () => {
    expect(checkFormOrder([{ question: "Team size", answerType: "choice", purpose: "qualify" }, { question: "Email", answerType: "email", purpose: "contact" }]).ok).toBe(true);
    const bad = checkFormOrder([{ question: "Email", answerType: "email", purpose: "contact" }, { question: "Budget", answerType: "choice", purpose: "qualify" }]);
    expect(bad).toEqual({ ok: false, firstBadIndex: 1 });
  });
  it("compliance flags", () => {
    expect(complianceFlags("Guaranteed results").map((f) => f.id)).toContain("guarantee");
    expect(complianceFlags("Grow 300% in a month").map((f) => f.id)).toContain("unevidenced_number");
    expect(complianceFlags("We cure back pain", { health: true }).map((f) => f.id)).toContain("clinical_claim");
    expect(complianceFlags("We cure back pain").map((f) => f.id)).not.toContain("clinical_claim");
    expect(complianceFlags("Friendly team")).toEqual([]);
  });
  it("copy problems", () => {
    expect(copyProblems("Our API uses tokens")).toHaveLength(2);
    expect(copyProblems("Plain words")).toEqual([]);
  });
});

describe("pre-launch check", () => {
  const ideas = Array.from({ length: 12 }, (_, i) => ({ idea: `Idea ${i + 1}` }));
  const scripts = ideas.map(() => ({ hook: "h", prove: "p", cta: "Click below to learn more." }));
  const ready: Record<string, unknown> = {
    ap_ideas: ideas,
    fa_scripts: scripts,
    ap_check_all: { passed: true, ideaCount: 12 },
    bf_build_6: true,
    bf_build_7: true,
    bf_build_8: true,
    lp_tracking: { checkedAt: "x", passed: true, pages: {} },
    lp_headline: "Booked out",
    msg_headline_chosen: "Booked out",
    fc_daily_budget: 50,
    mc_advantage_on: true,
    mc_off_text: true,
    mc_off_comments: true,
    mc_off_media: true,
    mc_off_image: true,
  };
  it("ready when everything is in place", () => {
    const r = prelaunchCheck(ready);
    expect(r.items.filter((i) => !i.ok)).toEqual([]);
    expect(r.ready).toBe(true);
  });
  it("reflects real state", () => {
    const r = prelaunchCheck({ ...ready, fa_scripts: [...scripts.slice(0, 11), { hook: "h", prove: "p", cta: "Book a call" }], mc_off_image: false });
    expect(r.ready).toBe(false);
    expect(r.items.find((i) => i.id === "cta")!.ok).toBe(false);
    expect(r.items.find((i) => i.id === "enhancements")!.ok).toBe(false);
    expect(prelaunchCheck({}).items.every((i) => !i.ok)).toBe(true);
  });
  it("ideas changed since check", () => {
    const r = prelaunchCheck({ ...ready, ap_ideas: [...ideas, { idea: "13" }] });
    expect(r.items.find((i) => i.id === "unique")!.ok).toBe(false);
  });
  it("1-step funnels don't need the schedule event", () => {
    const r = prelaunchCheck({ ...ready, bf_build_8: false }, { funnel: "1step" });
    expect(r.items.find((i) => i.id === "tracking")!.ok).toBe(true);
  });
});

describe("assist plumbing", () => {
  it("context keys pick only what a field needs", () => {
    const keys = contextKeys("msg_headline_2", "suggest");
    expect(keys).toContain("av_towards_*");
    expect(keys).toContain("msg_result");
    expect(keys).not.toContain("sa_agenda");
    expect(contextKeys("unknown", "ideas")).toContain("av_attempts_*");
  });
  it("context pack holds answers only and is capped", () => {
    const { text, usedKeys } = buildContext(["ws.industry", "av_towards_*", "msg_result", "site.services", "engine.forecast", "missing"], {
      answers: { av_towards_1: "a", av_towards_2: "b", msg_result: "x".repeat(5000), email: "someone@example.com" },
      ws: { industry: "Trades" },
      site: { services: ["Wiring"] },
      engine: { forecast: { revenue: 1 } },
    });
    expect(usedKeys).toEqual(["ws.industry", "av_towards_1", "av_towards_2", "msg_result", "site.services", "engine.forecast"]);
    expect(text).not.toContain("someone@example.com");
    expect(text.length).toBeLessThan(12_001);
  });
  it("costs", () => {
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 3000, output_tokens: 500 })).toBeCloseTo(0.011, 6);
    expect(costUsd("claude-opus-5-5", { input_tokens: 3000, output_tokens: 500 })).toBeCloseTo(0.022, 6);
    expect(costUsd("unknown", { input_tokens: 0, output_tokens: 1_000_000 })).toBe(20);
    expect(costUsd("claude-haiku-5-5", { input_tokens: 0, output_tokens: 0 }, 5)).toBeCloseTo(0.05);
    expect(Object.keys(MODELS)).toHaveLength(3);
  });
  it("every action has a schema and a task", () => {
    for (const a of Object.keys(ACTION_SPEC) as (keyof typeof ACTION_SPEC)[]) {
      expect(taskFor(a, "msg_headline_1").length).toBeGreaterThan(10);
      expect(copyProblems(ACTION_SPEC[a].loading + ACTION_SPEC[a].label)).toEqual([]);
    }
    expect(jsonSchemaFor(OptionsOut)).toHaveProperty("properties");
    expect(taskFor("check", "gs_headlines")).toMatch(/searcher/);
  });
});
