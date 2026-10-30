import type { AssistAction } from "../content/types.ts";

// Picks only the answers a field needs. Patterns ending in * match rows (av_towards_1..5).

const BASE = ["ws.industry", "ws.offer_line", "ws.service_city", "ws.audience_type", "ws.country", "ws.funnel_type", "ws.channel"];
const AVATAR = ["av_age_range", "av_location", "av_industry", "av_descriptors", "av_towards_*", "av_away_*", "av_attempts_*", "av_language_bank"];
const MESSAGE = ["msg_thing", "msg_result", "msg_feeling", "msg_headline_chosen", "msg_subheadline"];

const BY_FIELD: Record<string, string[]> = {
  c3_awareness: ["c3_awareness"],
  av_descriptors: ["av_age_range", "av_location", "av_industry", "av_descriptors", "site.services", "site.audience"],
  av_towards: [...AVATAR],
  av_away: [...AVATAR],
  av_attempts: [...AVATAR],
  msg_thing: ["msg_thing", "msg_result", "msg_feeling", "site.services", "site.headline", "av_descriptors"],
  msg_result: ["av_towards_*", "av_away_*", "av_language_bank", "msg_thing", "msg_result", "msg_feeling"],
  msg_feeling: ["av_towards_*", "av_away_*", "av_language_bank", "msg_thing", "msg_result", "msg_feeling"],
  msg_headline: ["av_towards_*", "av_away_*", "av_language_bank", "msg_result", "msg_feeling", "msg_headline_*"],
  msg_headline_chosen: ["msg_headline_*", "msg_result", "msg_feeling"],
  msg_subheadline: ["msg_thing", "msg_result", "msg_feeling", "msg_headline_chosen"],
  lp_headline: ["lp_headline", "msg_headline_chosen", "msg_result", "msg_feeling"],
  lp_subheadline: ["lp_subheadline", "msg_subheadline", "msg_thing"],
  lp_form_questions: ["av_descriptors", "ws.audience_type", "fc_offer_price", "lp_form_questions"],
  lp_booking_copy: ["msg_headline_chosen", "lp_booking_copy"],
  lp_thankyou_copy: ["msg_headline_chosen", "vsl_type", "lp_thankyou_copy"],
  lp_page: ["msg_headline_chosen", "msg_subheadline", "ap_ideas", "lp_form_questions"],
  bf_nurture: ["msg_headline_chosen", "av_attempts_*", "av_away_*", "bf_testimonials", "vsl_type"],
  ap_ideas: [...AVATAR, "msg_result", "msg_feeling", "ap_ideas"],
  fa_scripts: ["ap_ideas", "av_language_bank", "av_away_*", "msg_result", "msg_feeling", "msg_headline_chosen"],
  vsl_first30: ["av_away_*", "av_language_bank", "site.proof", "vsl_first30"],
  vsl_pillar1: ["av_attempts_*", "msg_thing", "msg_result", "vsl_pillar1"],
  vsl_good_problem: ["vsl_pillar1", "vsl_pillar2", "msg_thing"],
  vsl_pillar2: ["vsl_pillar1", "vsl_good_problem", "msg_thing", "msg_result", "vsl_pillar2"],
  vsl_faq: ["msg_thing", "msg_result", "fc_offer_price", "vsl_faq", "site.prices", "site.offers"],
  vsl_reviews: ["vsl_reviews", "site.proof"],
  vsl_opening: ["vsl_reviews", "msg_headline_chosen"],
  vsl_close: ["vsl_reviews", "msg_headline_chosen"],
  vsl_talking: ["vsl_type", "vsl_first30", "vsl_pillar1", "vsl_good_problem", "vsl_pillar2", "vsl_faq", "vsl_reviews", "vsl_opening", "vsl_close"],
  gs_keywords: ["gs_keywords", "site.services", "site.places"],
  gs_groups: ["gs_keywords"],
  gs_negatives: ["gs_keywords", "msg_thing"],
  gs_headlines: ["gs_keywords", ...MESSAGE, "av_language_bank"],
  gs_descriptions: ["gs_keywords", ...MESSAGE],
  au_which_warm: ["ap_ideas"],
  sa_agenda: ["msg_thing", "sa_agenda"],
  sa_discover: ["av_towards_*", "av_away_*", "sa_discover"],
  sa_pillar: ["vsl_pillar1", "vsl_pillar2", "msg_thing", "av_attempts_*", "sa_pillar_*"],
  sa_objections: ["av_attempts_*", "vsl_faq", "msg_thing", "fc_offer_price", "sa_objections"],
  sa_practice: [...AVATAR, "msg_thing", "msg_result", "fc_offer_price", "sa_objections", "vsl_pillar1", "vsl_pillar2"],
  fc_explain: ["engine.forecast", "engine.biggest_dial"],
  pr_diagnose: ["engine.red_dials"],
  op_test: ["engine.bottleneck"],
};

/** Keys of context needed for a field and action. */
export function contextKeys(fieldId: string, action: AssistAction): string[] {
  const base = fieldId.replace(/_\d+$/, "");
  const specific = BY_FIELD[fieldId] ?? BY_FIELD[base] ?? [];
  const extra: string[] = [];
  if (action === "ideas" || action === "more_like_this") extra.push("av_towards_*", "av_away_*", "av_attempts_*");
  if (action === "check" || action === "check_hook") extra.push("av_language_bank");
  return [...new Set([...BASE, ...specific, ...extra])];
}

export interface ContextSource {
  answers: Record<string, unknown>;
  ws: Record<string, unknown>;
  site?: Record<string, unknown> | null;
  engine?: Record<string, unknown>;
}

const MAX_CHARS = 12_000; // about 3,000 units of model input
const MAX_VALUE_CHARS = 1_500;

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/** Builds the context pack: workbook answers only (never email, user id or session data). */
export function buildContext(keys: string[], src: ContextSource): { text: string; usedKeys: string[] } {
  const lines: string[] = [];
  const used: string[] = [];
  const push = (k: string, v: unknown) => {
    let s = stringify(v).trim();
    if (!s || s === "[]" || s === "{}") return;
    if (s.length > MAX_VALUE_CHARS) s = `${s.slice(0, MAX_VALUE_CHARS)}...`;
    lines.push(`${k}: ${s}`);
    used.push(k);
  };
  for (const key of keys) {
    if (key.startsWith("ws.")) push(key, src.ws[key.slice(3)]);
    else if (key.startsWith("site.")) push(key, src.site?.[key.slice(5)]);
    else if (key.startsWith("engine.")) push(key, src.engine?.[key.slice(7)]);
    else if (key.endsWith("*")) {
      const prefix = key.slice(0, -1);
      for (const k of Object.keys(src.answers).filter((a) => a.startsWith(prefix)).sort()) push(k, src.answers[k]);
    } else push(key, src.answers[key]);
  }
  let text = lines.join("\n");
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
  return { text, usedKeys: used };
}
