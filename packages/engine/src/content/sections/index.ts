import type { Section, Condition, Field, Block } from "../types.ts";
import { PART_ONE } from "./part-one.ts";
import { PART_TWO } from "./part-two.ts";
import { PART_THREE } from "./part-three.ts";
import { PART_FOUR } from "./part-four.ts";
import { PART_FIVE_SIX } from "./part-five-six.ts";

/** All 15 sections in workbook order. */
export const SECTIONS: Section[] = [...PART_ONE, ...PART_TWO, ...PART_THREE, ...PART_FOUR, ...PART_FIVE_SIX];

export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);

/** Forecasting field ids (rendered by the forecaster component). */
export const FORECAST_FIELD_IDS = [
  "fc_funnel",
  "fc_daily_budget",
  "fc_offer_price",
  "fc_cpm",
  "fc_ctr",
  "fc_cpc",
  "fc_optin",
  "fc_booking",
  "fc_show",
  "fc_close",
  "fc_purchase",
  "fc_margin",
  "fc_revenue_goal",
  "fc_weekly_capacity",
] as const;

export interface ConditionContext {
  answers: Record<string, unknown>;
  ws: Partial<Record<NonNullable<Condition["ws"]>, string | null>>;
  compliance: string[];
}

const asList = (v: string | string[] | undefined) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

export function conditionHolds(c: Condition | undefined, ctx: ConditionContext): boolean {
  if (!c) return true;
  if (c.notCompliance && ctx.compliance.includes(c.notCompliance)) return false;
  const raw = c.field ? ctx.answers[c.field] : c.ws ? ctx.ws[c.ws] : undefined;
  const value = raw === undefined || raw === null ? "" : String(raw);
  const eq = asList(c.equals);
  const ne = asList(c.notEquals);
  if (eq && !eq.includes(value)) return false;
  if (ne && ne.includes(value)) return false;
  return true;
}

export function visibleSections(ctx: ConditionContext): Section[] {
  return SECTIONS.filter((s) => conditionHolds(s.showWhen, ctx));
}

/** Expands a field into the answer ids it stores ("rows" fields become id_1..id_n). */
export function fieldAnswerIds(f: Field): string[] {
  if (f.type === "rows") return Array.from({ length: f.count ?? 1 }, (_, i) => `${f.id}_${i + 1}`);
  return [f.id];
}

function blockFields(b: Block): Field[] {
  if (b.kind === "fields") return b.fields;
  if (b.kind === "row") return b.blocks.flatMap(blockFields);
  return [];
}

export function sectionFields(s: Section): Field[] {
  return s.blocks.flatMap(blockFields);
}

/** Every checklist item id in a section (including those nested in rows). */
export function sectionChecklistIds(s: Section): string[] {
  const walk = (b: Block): string[] => (b.kind === "checklist" ? b.items.map((i) => i.id) : b.kind === "row" ? b.blocks.flatMap(walk) : []);
  return s.blocks.flatMap(walk);
}

export function allFields(): Field[] {
  return SECTIONS.flatMap(sectionFields);
}

export function fieldById(id: string): Field | undefined {
  const base = id.replace(/_\d+$/, "");
  return allFields().find((f) => f.id === id || (f.type === "rows" && f.id === base));
}

/** Section a field id belongs to, by prefix. */
export function sectionForField(fieldId: string): Section | undefined {
  return SECTIONS.find((s) => fieldId.startsWith(s.prefix));
}
