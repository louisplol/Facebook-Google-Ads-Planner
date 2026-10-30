export type AssistAction =
  | "suggest"
  | "refine"
  | "ideas"
  | "check"
  | "go_deeper"
  | "real_cost"
  | "rank_drafts"
  | "explain_forecast"
  | "diagnose"
  | "fill_from_avatar"
  | "write_hooks"
  | "check_hook"
  | "check_all_ideas"
  | "more_like_this"
  | "script_idea"
  | "write_message"
  | "suggest_questions"
  | "review_page"
  | "check_tracking"
  | "pick_reviews"
  | "suggest_answers"
  | "talking_points"
  | "group_keywords"
  | "suggest_negatives"
  | "which_warm"
  | "suggest_followups"
  | "tie_downs"
  | "what_to_test"
  | "practice_call"
  | "explain_channel";

export type RecipeId = "site_scan" | "search_demand" | "customer_language" | "competitor_messages" | "ads_running" | "buyer_questions" | "keyword_plan";

export type FieldType = "text" | "textarea" | "number" | "currency" | "percent" | "choice" | "url" | "list" | "rows" | "checkbox";

/** Show a field or block only when a condition holds. */
export interface Condition {
  /** An answer in this workspace */
  field?: string;
  /** A workspace attribute set in onboarding or derived */
  ws?: "channel" | "funnel_type" | "industry_pack" | "sell_mode" | "audience_type";
  equals?: string | string[];
  notEquals?: string | string[];
  /** Hidden when the industry pack carries this compliance flag */
  notCompliance?: string;
}

export interface FieldOption {
  value: string;
  label: string;
  detail?: string;
  result?: string;
  /** Hidden when the industry pack carries this compliance flag */
  hiddenForCompliance?: string;
}

export interface Field {
  id: string;
  label: string;
  type: FieldType;
  help?: string;
  /** For "rows": number of rows, stored as `${id}_${n}` */
  count?: number;
  options?: FieldOption[];
  assists?: AssistAction[];
  research?: RecipeId;
  /** Prefill suggestion from another field or a workspace attribute ("ws.service_city") */
  prefillFrom?: string;
  /** Key into FORECAST_BENCHMARKS for the hint */
  benchmark?: string;
  /** Key into the industry pack examples. Defaults to the field id. */
  exampleKey?: string;
  showWhen?: Condition;
  unit?: string;
  maxChars?: number;
  /** Not in the reference workbook (new in this app) */
  isNew?: boolean;
  /** Panel tint for this field's box (Thing, Result, Feeling) */
  tone?: Tone;
  /** For "rows": lay rows out in this many columns */
  columns?: 1 | 2;
  /** Placeholder for rows beyond the pack's examples, such as "Motivator" (becomes "Motivator 3") */
  rowPlaceholder?: string;
}

/** Panel tints, matching the reference: plain dark, navy, green, brown. Accent tints for small boxes. */
export type Tone = "plain" | "navy" | "green" | "brown" | "teal" | "gold" | "red";

/** Shared panel options: a small mono chip label, a one line lead, a tint. */
interface Panel {
  chip?: string;
  chipTone?: "teal" | "gold" | "red";
  lead?: string;
  tone?: Tone;
  showWhen?: Condition;
}

export type Block =
  | ({ kind: "intro"; text: string } & Panel)
  | ({ kind: "note"; text: string; strong?: string; noteTone?: "teal" | "gold" | "red" | "grey" | "assumed" } & Panel)
  | ({ kind: "cards"; title?: string; columns?: 2 | 3; items: { title: string; body: string; meta?: string; quote?: string; tone?: "teal" | "gold" | "red"; number?: string }[] } & Panel)
  | ({ kind: "table"; title?: string; columns: string[]; rows: string[][]; firstColTones?: ("teal" | "gold" | "red" | "grey")[] } & Panel)
  | ({ kind: "steps"; title?: string; items: { title: string; time?: string; body: string }[] } & Panel)
  | ({ kind: "numbered"; items: { title: string; body: string }[] } & Panel)
  | ({ kind: "tiles"; items: { top: string; title: string }[]; after?: string } & Panel)
  | ({ kind: "fields"; title?: string; fields: Field[]; columns?: 1 | 2 | 3; bars?: boolean } & Panel)
  | ({ kind: "checklist"; id: string; title: string; goal?: string; items: { id: string; label: string; showWhen?: Condition; assist?: AssistAction; when?: string; ruleOnly?: boolean }[] } & Panel)
  | ({ kind: "row"; blocks: Block[] } & Panel)
  | ({ kind: "custom"; component: string } & Panel);

export interface Section {
  id: string;
  number: number;
  /** Short name for the sidebar */
  title: string;
  /** Long name for the page heading, when different */
  heading?: string;
  /** Glyph shown in the heading tile */
  icon: string;
  accent: "orange" | "teal" | "gold";
  part: 1 | 2 | 3 | 4 | 5 | 6;
  /** True when the screenshots didn't show this section's part label */
  partAssumed?: boolean;
  video: { start: string; end: string; assumed?: boolean } | null;
  summary: string;
  blocks: Block[];
  showWhen?: Condition;
  /** Proposed design, not from the reference */
  proposed?: boolean;
  isNew?: boolean;
  /** Answers prefix used for this section's field ids */
  prefix: string;
}

export const PARTS: Record<number, string> = {
  1: "Part One: Strategy",
  2: "Part Two: Build",
  3: "Part Three: Create",
  4: "Part Four: Launch",
  5: "Part Five: Close",
  6: "Part Six: Optimise",
};
