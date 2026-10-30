import type { AudienceType, FunnelType } from "../calc/forecast.ts";

export type ComplianceFlag = "health_practitioner" | "special_ad_category" | "checkout";

/** Example placeholders, keyed by field id (rows fields use the base id and take a list). */
export interface ExampleSet {
  offer_line: string;
  av_age_range: string;
  av_location: string;
  av_industry: string;
  av_descriptors: string;
  av_towards: string[];
  av_away: string[];
  av_attempts: string[];
  msg_thing: string;
  msg_result: string;
  msg_feeling: string;
  msg_headline: string[];
  msg_subheadline: string;
  lp_booking_copy: string;
  lp_thankyou_copy: string;
  /** Application form questions, low commitment first and contact details last */
  lp_form_questions: string[];
  /** One example per row of the 12 ad ideas table */
  ap_ideas: string[];
  /** A hook for each idea above, in committed language */
  ap_hooks: string[];
  /** Filming: the "prove your point" part of a script */
  fa_prove: string;
  vsl_first30: string;
  vsl_pillar1: string;
  vsl_good_problem: string;
  vsl_pillar2: string;
  vsl_faq: string;
  vsl_reviews: string;
  vsl_opening: string;
  vsl_close: string;
  gs_groups: string;
  gs_negatives: string;
  /** Google ad headlines (30 characters or fewer) and descriptions (90 or fewer) */
  gs_headlines: string[];
  gs_descriptions: string[];
  sa_agenda: string;
  sa_discover: string;
  /** Pitch notes for pillar 1 and pillar 2 */
  sa_pillar: string[];
  sa_objections: string;
}

export interface IndustryPack {
  key: string;
  label: string;
  /** One line shown in onboarding */
  description: string;
  funnel_default: FunnelType;
  audience_type: AudienceType;
  /** Emergency or search-led businesses start with "Check with search data" open */
  search_led: boolean;
  compliance: ComplianceFlag[];
  /** Notes shown in the relevant sections */
  compliance_notes?: string[];
  /** Software pack: archetype funnel replaces the Forecasting stages */
  software?: boolean;
  examples: ExampleSet;
  /** Draft content pending owner review */
  reviewStatus: "draft_pending_review" | "reviewed";
}
