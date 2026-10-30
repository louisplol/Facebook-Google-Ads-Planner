import { describe, it, expect } from "vitest";
import { SECTIONS, visibleSections, conditionHolds, fieldAnswerIds, allFields, fieldById, sectionForField, sectionById, sectionFields } from "../src/content/sections/index.ts";
import { INDUSTRY_PACKS, packByKey, exampleFor } from "../src/industries/index.ts";
import { PRINCIPLES, principleById } from "../src/method/principles.ts";
import { BOTTLENECKS } from "../src/method/bottlenecks.ts";
import { GLOSSARY } from "../src/method/glossary.ts";
import { copyProblems } from "../src/validate/index.ts";
import * as B from "../src/config/benchmarks.ts";

const ctx = (ws: Record<string, string> = {}, answers: Record<string, unknown> = {}, compliance: string[] = []) => ({ ws, answers, compliance });

describe("sections", () => {
  it("has 15 sections in order", () => {
    expect(SECTIONS).toHaveLength(15);
    expect(SECTIONS.map((s) => s.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(15);
  });
  it("google section shows only for google", () => {
    expect(visibleSections(ctx({ channel: "meta" })).map((s) => s.id)).not.toContain("google-search");
    expect(visibleSections(ctx({ channel: "google" })).map((s) => s.id)).toContain("google-search");
  });
  it("sales hidden for checkout", () => {
    expect(visibleSections(ctx({ funnel_type: "checkout" })).map((s) => s.id)).not.toContain("sales");
  });
  it("conditions", () => {
    expect(conditionHolds(undefined, ctx())).toBe(true);
    expect(conditionHolds({ field: "vsl_type", equals: "story_arc" }, ctx({}, { vsl_type: "story_arc" }))).toBe(true);
    expect(conditionHolds({ field: "vsl_type", equals: "story_arc" }, ctx({}, {}))).toBe(false);
    expect(conditionHolds({ notCompliance: "health_practitioner" }, ctx({}, {}, ["health_practitioner"]))).toBe(false);
    expect(conditionHolds({ ws: "funnel_type", notEquals: ["1step", "checkout"] }, ctx({ funnel_type: "1step" }))).toBe(false);
  });
  it("field ids use the section prefix", () => {
    for (const s of SECTIONS) for (const f of sectionFields(s)) expect(f.id.startsWith(s.prefix)).toBe(true);
  });
  it("rows expand to numbered ids", () => {
    const f = fieldById("av_towards_3")!;
    expect(f.id).toBe("av_towards");
    expect(fieldAnswerIds(f)).toEqual(["av_towards_1", "av_towards_2", "av_towards_3", "av_towards_4", "av_towards_5"]);
    expect(fieldAnswerIds(fieldById("msg_headline_chosen")!)).toEqual(["msg_headline_chosen"]);
    expect(sectionForField("msg_result")?.id).toBe("messaging");
    expect(sectionById("vsl")?.title).toBe("VSL");
    expect(allFields().length).toBeGreaterThan(30);
  });
  it("plan field ids exist", () => {
    for (const id of ["c3_awareness", "av_age_range", "av_descriptors", "av_towards_5", "av_away_5", "av_attempts_6", "msg_thing", "msg_result", "msg_feeling", "msg_headline_3", "msg_headline_chosen", "msg_subheadline", "lp_headline", "lp_booking_copy", "vsl_first30", "vsl_faq", "vsl_reviews", "vsl_close", "gs_negatives", "au_pixel_events", "au_customer_list_size", "sa_agenda", "sa_plan_uplift", "sa_objections"]) {
      expect(fieldById(id), id).toBeTruthy();
    }
  });
});

describe("copy rules", () => {
  it("no em or en dashes and no tech talk in any section copy", () => {
    const text = JSON.stringify(SECTIONS);
    expect(copyProblems(text)).toEqual([]);
  });
  it("no dashes or tech talk in packs, principles, bottlenecks, glossary", () => {
    expect(copyProblems(JSON.stringify(INDUSTRY_PACKS))).toEqual([]);
    expect(copyProblems(JSON.stringify(PRINCIPLES))).toEqual([]);
    expect(copyProblems(JSON.stringify(BOTTLENECKS.map(({ test, ...r }) => r)))).toEqual([]);
    expect(copyProblems(JSON.stringify(GLOSSARY))).toEqual([]);
  });
});

describe("industry packs", () => {
  it("ships 9 packs with complete example sets", () => {
    expect(INDUSTRY_PACKS.map((p) => p.key)).toEqual(["coaching", "trades", "health", "professional", "beauty", "hospitality", "education", "software", "other"]);
    for (const p of INDUSTRY_PACKS) {
      expect(p.examples.av_towards).toHaveLength(5);
      expect(p.examples.av_away).toHaveLength(5);
      expect(p.examples.av_attempts).toHaveLength(6);
      expect(p.examples.msg_headline).toHaveLength(3);
      // Every row of the 12 ideas table shows an example idea and hook.
      expect(p.examples.ap_ideas).toHaveLength(12);
      expect(p.examples.ap_hooks).toHaveLength(12);
      expect(p.examples.sa_pillar).toHaveLength(2);
      expect(p.examples.lp_form_questions.length).toBeGreaterThanOrEqual(6);
      for (const h of p.examples.gs_headlines) expect(h.length, h).toBeLessThanOrEqual(30);
      for (const d of p.examples.gs_descriptions) expect(d.length, d).toBeLessThanOrEqual(90);
      // Hooks sell the click, never the booking (Principle 07).
      for (const h of p.examples.ap_hooks) expect(h, h).not.toMatch(/\b(book a call|call us|ring us)\b/i);
      for (const v of Object.values(p.examples).flat()) expect(copyProblems(v), v).toEqual([]);
    }
  });
  it("coaching uses the reference examples as written", () => {
    const c = packByKey("coaching");
    expect(exampleFor(c, "av_towards_1")).toBe("consistent inbound leads");
    expect(exampleFor(c, "av_towards_2")).toBe("confidence on camera");
    expect(exampleFor(c, "av_away_1")).toBe("burnt $15k on agency, nothing");
    expect(exampleFor(c, "av_away_2")).toBe("word of mouth plateauing");
    expect(exampleFor(c, "av_attempts_3")).toBe("Tried UGC creators");
    expect(exampleFor(c, "av_descriptors")).toBe("Established business owner, 5+ years, has a team, revenue $500k+");
    expect(exampleFor(c, "msg_headline_1")).toBe("Go from invisible to booked out without relying on word of mouth");
    expect(exampleFor(c, "msg_headline_2")).toBe("The system Perth business owners use to get consistent leads without an agency");
    expect(exampleFor(c, "ap_ideas_3")).toBe("Know they need content but freeze on camera");
  });
  it("defaults and compliance", () => {
    expect(packByKey("trades").funnel_default).toBe("1step");
    expect(packByKey("health").compliance).toContain("health_practitioner");
    expect(packByKey("software").software).toBe(true);
    expect(packByKey("nope").key).toBe("other");
    expect(packByKey(null).key).toBe("other");
  });
  it("example lookup", () => {
    const t = packByKey("trades");
    expect(exampleFor(t, "msg_headline_1")).toBe("Booked three weeks ahead without chasing quotes");
    expect(exampleFor(t, "av_away_1")).toBe("Paying for leads that never answer the phone");
    expect(exampleFor(t, "msg_thing")).toMatch(/electrical/);
    expect(exampleFor(t, "unknown_field")).toBeUndefined();
    expect(exampleFor(packByKey("professional"), "msg_headline_1")).toBe("Tax time handled, so you stop dreading June");
    expect(exampleFor(packByKey("software"), "msg_headline_1")).toBe("Close the month in two days, not two weeks");
  });
});

describe("method", () => {
  it("10 principles", () => {
    expect(PRINCIPLES).toHaveLength(10);
    expect(principleById("p08")?.title).toBe("Curious vs Committed");
  });
  it("6 bottleneck rows in order", () => expect(BOTTLENECKS.map((b) => b.id)).toEqual([1, 2, 3, 4, 5, 6]));
});

describe("benchmarks always carry a source and date", () => {
  const walk = (o: unknown, path: string) => {
    if (o && typeof o === "object" && "value" in (o as object)) {
      const s = o as B.Sourced<unknown>;
      expect(typeof s.source, path).toBe("string");
      expect(s.asOf, path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      return;
    }
    if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  };
  it("every benchmark", () => {
    for (const k of ["FORECAST_BENCHMARKS", "BOTTLENECK_THRESHOLDS", "PLAYBOOK_RULES", "AUDIENCE_RULES", "TIME", "GOOGLE_AD_LIMITS", "PENDING"] as const) walk(B[k], k);
    walk(B.MIN_AD_IDEAS, "MIN_AD_IDEAS");
    walk(B.SMS_SEGMENT_CHARS, "SMS");
    walk(B.CPM_COLOUR_RULE, "CPM");
  });
  it("pending decisions stay null", () => {
    expect(B.PENDING.searchDemandThreshold.value).toBeNull();
    expect(B.PENDING.usdToAud.value).toBeNull();
  });
  it("band midpoint", () => {
    expect(B.bandMidpoint({ low: 0.3, high: 0.5, hint: "" })).toBeCloseTo(0.4);
    expect(B.bandMidpoint({ low: 0.7, high: null, hint: "" })).toBe(0.7);
  });
});
