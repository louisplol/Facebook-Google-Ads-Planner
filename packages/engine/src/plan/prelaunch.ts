import { checkAdCta } from "../validate/index.ts";
import { MIN_AD_IDEAS } from "../config/benchmarks.ts";

export interface AdIdea {
  idea: string;
  source?: string;
  hook?: string;
}

export type ScriptStatus = "scripted" | "filmed" | "edited" | "captioned" | "live";

export interface AdScript {
  hook: string;
  prove: string;
  cta: string;
  status?: ScriptStatus;
  shotNotes?: string;
}

export interface TrackingResult {
  checkedAt: string;
  passed: boolean;
  pages: Record<string, { pixel: boolean | null; lead: boolean | null; schedule: boolean | null; note?: string }>;
}

export interface PrelaunchItem {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
  fixIn: { section: string; label: string };
}

const truthy = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";

export function adIdeasFrom(answers: Record<string, unknown>): AdIdea[] {
  const v = answers.ap_ideas;
  return Array.isArray(v) ? (v as AdIdea[]).filter((x) => x && typeof x.idea === "string" && x.idea.trim() !== "") : [];
}

export function scriptsFrom(answers: Record<string, unknown>): AdScript[] {
  const v = answers.fa_scripts;
  return Array.isArray(v) ? (v as AdScript[]) : [];
}

/** Engine-only pre-launch check: turns the six rules and earlier sections into one ready list. */
export function prelaunchCheck(answers: Record<string, unknown>, opts: { funnel?: string | null } = {}): { ready: boolean; items: PrelaunchItem[] } {
  const ideas = adIdeasFrom(answers);
  const scripts = scriptsFrom(answers);
  const min = MIN_AD_IDEAS.value;
  const scripted = ideas.filter((_, i) => scripts[i] && (scripts[i].hook?.trim() || scripts[i].prove?.trim())).length;
  const ctaFails = scripts.filter((s, i) => i < ideas.length && s && (s.hook || s.prove) && !checkAdCta(s.cta ?? "").ok).length;
  const checkAll = answers.ap_check_all as { passed?: boolean; ideaCount?: number } | undefined;
  const tracking = answers.lp_tracking as TrackingResult | undefined;
  const twoStep = opts.funnel !== "1step" && opts.funnel !== "checkout";
  const lpHeadline = String(answers.lp_headline ?? "").trim();
  const chosen = String(answers.msg_headline_chosen ?? "").trim();

  const items: PrelaunchItem[] = [
    {
      id: "ideas",
      label: `${min} or more ad ideas, each scripted`,
      ok: ideas.length >= min && scripted >= min,
      detail: `${ideas.length} ideas, ${scripted} scripted`,
      fixIn: { section: ideas.length < min ? "ad-principles" : "filming-ads", label: ideas.length < min ? "Ad Principles" : "Filming Ads" },
    },
    {
      id: "unique",
      label: "\"Check all 12\" passed: no two ideas too alike",
      ok: !!checkAll?.passed && (checkAll.ideaCount ?? 0) === ideas.length && ideas.length >= min,
      detail: checkAll?.passed ? (checkAll.ideaCount === ideas.length ? "Passed" : "Ideas changed since the last check") : "Not checked yet",
      fixIn: { section: "ad-principles", label: "Ad Principles" },
    },
    {
      id: "cta",
      label: "Every script's call to action sells only the next step",
      ok: scripts.length > 0 && ctaFails === 0,
      detail: ctaFails ? `${ctaFails} script${ctaFails === 1 ? "" : "s"} to fix` : scripts.length ? "All passed" : "No scripts yet",
      fixIn: { section: "filming-ads", label: "Filming Ads" },
    },
    {
      id: "tracking",
      label: twoStep ? "Pixel, Lead event and Schedule event ticked, and Check tracking passed" : "Pixel and Lead event ticked, and Check tracking passed",
      ok: truthy(answers.bf_build_6) && truthy(answers.bf_build_7) && (!twoStep || truthy(answers.bf_build_8)) && !!tracking?.passed,
      detail: tracking ? (tracking.passed ? "Tracking check passed" : "Tracking check found gaps") : "Tracking not checked yet",
      fixIn: { section: "build-funnel", label: "Build Funnel" },
    },
    {
      id: "headline",
      label: "Landing page headline matches your chosen headline",
      ok: chosen !== "" && lpHeadline.toLowerCase() === chosen.toLowerCase(),
      fixIn: { section: "landing-page", label: "Landing Page" },
    },
    {
      id: "budget",
      label: "A daily budget set in Forecasting",
      ok: typeof answers.fc_daily_budget === "number" && (answers.fc_daily_budget as number) > 0,
      fixIn: { section: "forecasting", label: "Forecasting" },
    },
    { id: "advantage", label: "Advantage+ audience on", ok: truthy(answers.mc_advantage_on), fixIn: { section: "meta-campaign", label: "Meta Campaign" } },
    {
      id: "enhancements",
      label: "All four automatic creative enhancements off",
      ok: ["mc_off_text", "mc_off_comments", "mc_off_media", "mc_off_image"].every((k) => truthy(answers[k])),
      fixIn: { section: "meta-campaign", label: "Meta Campaign" },
    },
  ];
  return { ready: items.every((i) => i.ok), items };
}
