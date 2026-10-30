// Software pack: archetype funnels replace the Forecasting stages, and payback and lifetime
// value maths appear in My Plan. Pure formulas only; no benchmark numbers live here.
import { TIME } from "../config/benchmarks.ts";

export type SoftwareArchetype = "self_serve" | "sales_led";

export interface ArchetypeStage {
  key: string;
  label: string;
  rateLabel: string;
}

export const ARCHETYPE_STAGES: Record<SoftwareArchetype, { entry: string; stages: ArchetypeStage[] }> = {
  self_serve: {
    entry: "Visitors",
    stages: [
      { key: "signups", label: "Signups", rateLabel: "Visitor to signup rate" },
      { key: "activated", label: "Activated", rateLabel: "Signup to activated rate" },
      { key: "paid", label: "Paid", rateLabel: "Activated to paid rate" },
    ],
  },
  sales_led: {
    entry: "Leads",
    stages: [
      { key: "qualified", label: "Qualified", rateLabel: "Lead to qualified rate" },
      { key: "meetings", label: "Meetings", rateLabel: "Qualified to meeting rate" },
      { key: "opportunities", label: "Opportunities", rateLabel: "Meeting to opportunity rate" },
      { key: "won", label: "Won", rateLabel: "Opportunity to won rate" },
    ],
  },
};

export interface StageLine {
  key: string;
  label: string;
  monthly: number | null;
  costEach: number | "none_yet" | null;
  formula: string;
}

export interface SoftwareForecast {
  monthlySpend: number | null;
  lines: StageLine[];
  newCustomers: number | null;
  newMrr: number | null;
  cac: number | "none_yet" | null;
}

/**
 * entryCount comes from the ad funnel (clicks for self serve, leads for sales led).
 * rates are fractions keyed by stage key. arpa is monthly revenue per account.
 */
export function softwareForecast(
  archetype: SoftwareArchetype,
  dailyBudget: number | null,
  entryCount: number | null,
  rates: Record<string, number | null>,
  arpa: number | null,
): SoftwareForecast {
  const monthlySpend = dailyBudget === null ? null : dailyBudget * TIME.daysPerMonth.value;
  const def = ARCHETYPE_STAGES[archetype];
  const lines: StageLine[] = [];
  let prev = entryCount;
  let prevLabel = def.entry.toLowerCase();
  lines.push({ key: "entry", label: def.entry, monthly: entryCount, costEach: ce(monthlySpend, entryCount), formula: `${def.entry} from your ad funnel` });
  for (const s of def.stages) {
    const r = rates[s.key];
    const v = prev === null || r === null || r === undefined ? null : prev * r;
    lines.push({ key: s.key, label: s.label, monthly: v, costEach: ce(monthlySpend, v), formula: `${s.label} = ${prevLabel} x ${s.rateLabel.toLowerCase()}` });
    prev = v;
    prevLabel = s.label.toLowerCase();
  }
  const newCustomers = prev;
  return {
    monthlySpend,
    lines,
    newCustomers,
    newMrr: newCustomers === null || arpa === null ? null : newCustomers * arpa,
    cac: ce(monthlySpend, newCustomers),
  };
}

function ce(spend: number | null, n: number | null): number | "none_yet" | null {
  if (spend === null || n === null) return null;
  return n <= 0 ? "none_yet" : spend / n;
}

export interface UnitEconomics {
  ltv: number | null;
  paybackMonths: number | null;
  ltvToCac: number | null;
  formulas: { ltv: string; payback: string; ratio: string };
}

/** LTV = ARPA x gross margin / monthly churn. Payback = CAC / (ARPA x gross margin). */
export function unitEconomics(arpa: number | null, grossMargin: number | null, monthlyChurn: number | null, cac: number | null): UnitEconomics {
  const formulas = {
    ltv: "Lifetime value = monthly revenue per account x gross margin / monthly churn",
    payback: "Payback months = cost to win a customer / (monthly revenue per account x gross margin)",
    ratio: "Lifetime value to cost ratio = lifetime value / cost to win a customer",
  };
  const contrib = arpa !== null && grossMargin !== null ? arpa * grossMargin : null;
  const ltv = contrib !== null && monthlyChurn !== null && monthlyChurn > 0 ? contrib / monthlyChurn : null;
  const paybackMonths = contrib !== null && contrib > 0 && cac !== null ? cac / contrib : null;
  const ltvToCac = ltv !== null && cac !== null && cac > 0 ? ltv / cac : null;
  return { ltv, paybackMonths, ltvToCac, formulas };
}
