import { FORECAST_BENCHMARKS, TIME, bandMidpoint, CPM_COLOUR_RULE, type Band } from "../config/benchmarks.ts";

export type FunnelType = "2step" | "1step" | "checkout";
export type Channel = "meta" | "google";
export type AudienceType = "b2b" | "b2c" | "both";

export interface ForecastInputs {
  funnel: FunnelType;
  channel?: Channel;
  dailyBudget: number | null;
  offerPrice: number | null;
  /** Meta mode */
  cpm?: number | null;
  ctr?: number | null;
  /** Google mode: cost per click in the user's currency */
  cpc?: number | null;
  optin: number | null;
  booking?: number | null;
  show?: number | null;
  close?: number | null;
  /** checkout funnel: purchase rate of product page visitors */
  purchase?: number | null;
  /** What you keep after delivery costs, fraction */
  margin?: number | null;
}

export type CostEach = number | "none_yet" | null;

export interface ForecastLine {
  key: string;
  label: string;
  monthly: number | null;
  annual: number | null;
  costEach?: CostEach;
  formula: string;
  /** Unrounded inputs this line used, for "show your working". */
  inputs: Record<string, number | null>;
  kind: "currency" | "count" | "ratio";
}

export interface ForecastResult {
  ok: boolean;
  missing: string[];
  lines: ForecastLine[];
  byKey: Record<string, ForecastLine>;
  roas: number | null;
  grossProfit: number | null;
}

const LABELS: Record<string, string> = {
  dailyBudget: "Daily Ad Budget",
  offerPrice: "Offer Price",
  cpm: "CPM",
  ctr: "Link CTR",
  cpc: "Cost per click",
  optin: "Opt-in Rate",
  booking: "Booking Rate",
  show: "Show Rate",
  close: "Close Rate",
  purchase: "Purchase Rate",
};

/** Which inputs a funnel needs. */
export function requiredInputs(funnel: FunnelType, channel: Channel = "meta"): (keyof ForecastInputs)[] {
  const top: (keyof ForecastInputs)[] = channel === "google" ? ["dailyBudget", "offerPrice", "cpc"] : ["dailyBudget", "offerPrice", "cpm", "ctr"];
  if (funnel === "checkout") return [...top, "purchase"];
  if (funnel === "1step") return [...top, "optin", "show", "close"];
  return [...top, "optin", "booking", "show", "close"];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Cost each: "none_yet" when the count is zero, null when unknown. */
function costEach(spend: number | null, count: number | null): CostEach {
  if (spend === null || count === null) return null;
  if (count <= 0) return "none_yet";
  return spend / count;
}

export function forecast(input: ForecastInputs): ForecastResult {
  const channel = input.channel ?? "meta";
  const missing = requiredInputs(input.funnel, channel)
    .filter((k) => !isNum(input[k]))
    .map((k) => LABELS[k as string] ?? String(k));

  const daysPerMonth = TIME.daysPerMonth.value;
  const daysPerYear = TIME.daysPerYear.value;
  const months = TIME.monthsPerYear.value;
  const n = (v: number | null | undefined) => (isNum(v) ? v : null);
  const mul = (...xs: (number | null)[]) => (xs.every((x) => x !== null) ? xs.reduce<number>((a, b) => a * (b as number), 1) : null);
  const x12 = (v: number | null) => (v === null ? null : v * months);

  const daily = n(input.dailyBudget);
  const price = n(input.offerPrice);
  const monthlySpend = daily === null ? null : daily * daysPerMonth;
  const annualSpend = daily === null ? null : daily * daysPerYear;

  const lines: ForecastLine[] = [];
  lines.push({
    key: "spend",
    label: "Ad spend",
    monthly: monthlySpend,
    annual: annualSpend,
    formula: `Monthly = daily budget x ${daysPerMonth}. Annual = daily budget x ${daysPerYear}`,
    inputs: { dailyBudget: daily },
    kind: "currency",
  });

  let clicks: number | null;
  if (channel === "google") {
    const cpc = n(input.cpc);
    clicks = monthlySpend !== null && cpc !== null && cpc > 0 ? monthlySpend / cpc : null;
    lines.push({
      key: "clicks",
      label: "Clicks",
      monthly: clicks,
      annual: x12(clicks),
      costEach: costEach(monthlySpend, clicks),
      formula: "Clicks = monthly spend / cost per click",
      inputs: { monthlySpend, cpc },
      kind: "count",
    });
  } else {
    const cpm = n(input.cpm);
    const impressions = monthlySpend !== null && cpm !== null && cpm > 0 ? (monthlySpend / cpm) * 1000 : null;
    lines.push({
      key: "impressions",
      label: "Impressions",
      monthly: impressions,
      annual: x12(impressions),
      formula: "Impressions = monthly spend / CPM x 1,000",
      inputs: { monthlySpend, cpm },
      kind: "count",
    });
    clicks = mul(impressions, n(input.ctr));
    lines.push({
      key: "clicks",
      label: "Clicks",
      monthly: clicks,
      annual: x12(clicks),
      costEach: costEach(monthlySpend, clicks),
      formula: "Clicks = impressions x link CTR",
      inputs: { impressions, ctr: n(input.ctr) },
      kind: "count",
    });
  }

  let deals: number | null;
  if (input.funnel === "checkout") {
    deals = mul(clicks, n(input.purchase));
    lines.push({
      key: "deals",
      label: "Purchases",
      monthly: deals,
      annual: x12(deals),
      costEach: costEach(monthlySpend, deals),
      formula: "Purchases = clicks x purchase rate",
      inputs: { clicks, purchase: n(input.purchase) },
      kind: "count",
    });
  } else {
    const leads = mul(clicks, n(input.optin));
    lines.push({
      key: "leads",
      label: "Leads",
      monthly: leads,
      annual: x12(leads),
      costEach: costEach(monthlySpend, leads),
      formula: "Leads = clicks x opt-in rate",
      inputs: { clicks, optin: n(input.optin) },
      kind: "count",
    });
    let conversations: number | null;
    if (input.funnel === "2step") {
      const bookings = mul(leads, n(input.booking));
      lines.push({
        key: "bookings",
        label: "Bookings",
        monthly: bookings,
        annual: x12(bookings),
        costEach: costEach(monthlySpend, bookings),
        formula: "Bookings = leads x booking rate",
        inputs: { leads, booking: n(input.booking) },
        kind: "count",
      });
      conversations = mul(bookings, n(input.show));
      lines.push({
        key: "conversations",
        label: "Conversations",
        monthly: conversations,
        annual: x12(conversations),
        formula: "Conversations = bookings x show rate",
        inputs: { bookings, show: n(input.show) },
        kind: "count",
      });
    } else {
      // 1-step funnel (assumed): skips the booking stage.
      conversations = mul(leads, n(input.show));
      lines.push({
        key: "conversations",
        label: "Conversations",
        monthly: conversations,
        annual: x12(conversations),
        formula: "Conversations = leads x show rate (1-step funnel skips booking; assumed)",
        inputs: { leads, show: n(input.show) },
        kind: "count",
      });
    }
    deals = mul(conversations, n(input.close));
    lines.push({
      key: "deals",
      label: "Deals",
      monthly: deals,
      annual: x12(deals),
      costEach: costEach(monthlySpend, deals),
      formula: "Deals = conversations x close rate",
      inputs: { conversations, close: n(input.close) },
      kind: "count",
    });
  }

  const revenue = mul(deals, price);
  lines.push({
    key: "revenue",
    label: "Revenue",
    monthly: revenue,
    annual: x12(revenue),
    formula: input.funnel === "checkout" ? "Revenue = purchases x average order value" : "Revenue = deals x offer price",
    inputs: { deals, offerPrice: price },
    kind: "currency",
  });

  const roas = revenue !== null && monthlySpend !== null && monthlySpend > 0 ? revenue / monthlySpend : null;
  lines.push({
    key: "roas",
    label: "ROAS",
    monthly: roas,
    annual: null,
    formula: "ROAS = revenue / monthly spend",
    inputs: { revenue, monthlySpend },
    kind: "ratio",
  });

  const margin = n(input.margin);
  const grossProfit = revenue !== null && margin !== null && monthlySpend !== null ? revenue * margin - monthlySpend : null;
  lines.push({
    key: "grossProfit",
    label: "Gross profit",
    monthly: grossProfit,
    annual: grossProfit === null ? null : grossProfit * months,
    formula: "Gross profit = revenue x what you keep - monthly spend",
    inputs: { revenue, margin, monthlySpend },
    kind: "currency",
  });

  const byKey = Object.fromEntries(lines.map((l) => [l.key, l]));
  return { ok: missing.length === 0, missing, lines, byKey, roas, grossProfit };
}

// ---------- Colours ----------

export type Colour = "red" | "green" | "gold" | "none";

export function colourForBand(value: number | null | undefined, band: Band): Colour {
  if (!isNum(value)) return "none";
  if (band.inverted) {
    if (value <= band.low) return "green";
    return "red";
  }
  if (value < band.low) return "red";
  if (band.high !== null && value > band.high) return "gold";
  return "green";
}

export function cpmTypical(audience: AudienceType): number {
  return audience === "b2b" ? FORECAST_BENCHMARKS.cpmB2B.value.typical : FORECAST_BENCHMARKS.cpmB2C.value.typical;
}

export function colourForCpm(value: number | null | undefined, audience: AudienceType): Colour {
  if (!isNum(value)) return "none";
  void CPM_COLOUR_RULE;
  return value <= cpmTypical(audience) ? "green" : "red";
}

export type RateKey = "ctr" | "optin" | "booking" | "show" | "close";

export function forecastColours(input: ForecastInputs, audience: AudienceType = "b2c"): Partial<Record<RateKey | "cpm", Colour>> {
  const out: Partial<Record<RateKey | "cpm", Colour>> = {};
  if ((input.channel ?? "meta") === "meta") {
    out.cpm = colourForCpm(input.cpm, audience);
    out.ctr = colourForBand(input.ctr, FORECAST_BENCHMARKS.ctr.value);
  }
  if (input.funnel !== "checkout") {
    out.optin = colourForBand(input.optin, FORECAST_BENCHMARKS.optin.value);
    if (input.funnel === "2step") out.booking = colourForBand(input.booking, FORECAST_BENCHMARKS.booking.value);
    out.show = colourForBand(input.show, FORECAST_BENCHMARKS.show.value);
    out.close = colourForBand(input.close, FORECAST_BENCHMARKS.close.value);
  }
  return out;
}

// ---------- Biggest dial ----------

export interface DialRank {
  key: RateKey;
  label: string;
  current: number;
  target: number;
  revenueGain: number;
  formula: string;
}

/**
 * Every rate multiplies, so revenue gained by moving one rate to its benchmark midpoint is
 * revenue x (midpoint / current - 1). Rates already at or above midpoint gain nothing.
 */
export function biggestDial(input: ForecastInputs): DialRank[] {
  const result = forecast(input);
  const revenue = result.byKey.revenue?.monthly;
  if (!result.ok || revenue === null || revenue === undefined) return [];
  const keys: RateKey[] = [];
  if ((input.channel ?? "meta") === "meta") keys.push("ctr");
  if (input.funnel !== "checkout") {
    keys.push("optin");
    if (input.funnel === "2step") keys.push("booking");
    keys.push("show", "close");
  }
  const ranks: DialRank[] = [];
  for (const key of keys) {
    const current = input[key] as number;
    const band = FORECAST_BENCHMARKS[key].value as Band;
    const target = bandMidpoint(band);
    if (!(current > 0)) continue;
    const gain = current >= target ? 0 : revenue * (target / current - 1);
    ranks.push({
      key,
      label: LABELS[key] ?? key,
      current,
      target,
      revenueGain: gain,
      formula: `Revenue gain = monthly revenue x (benchmark midpoint ${(target * 100).toFixed(1)}% / your ${(current * 100).toFixed(1)}% - 1)`,
    });
  }
  return ranks.sort((a, b) => b.revenueGain - a.revenueGain);
}

// ---------- Work backwards ----------

export interface WorkBackwardsResult {
  dailyBudget: number | null;
  cappedDailyBudget: number | null;
  conversationsNeeded: number | null;
  capacityPerMonth: number | null;
  cappedByCapacity: boolean;
  formula: string;
}

/**
 * Revenue is linear in daily budget, so budget = goal / (revenue per $1 of daily budget).
 * Weekly capacity (sales calls a week) caps conversations at capacity x (30.4 / 7) a month.
 */
export function workBackwards(input: ForecastInputs, monthlyRevenueGoal: number, weeklyCapacity?: number | null): WorkBackwardsResult {
  const perDollar = forecast({ ...input, dailyBudget: 1 });
  const revPerDollar = perDollar.byKey.revenue?.monthly ?? null;
  const convPerDollar = (perDollar.byKey.conversations ?? perDollar.byKey.deals)?.monthly ?? null;
  const formula = "Daily budget needed = revenue goal / revenue from $1 a day at your current rates";
  if (!perDollar.ok || !revPerDollar || revPerDollar <= 0 || !(monthlyRevenueGoal > 0)) {
    return { dailyBudget: null, cappedDailyBudget: null, conversationsNeeded: null, capacityPerMonth: null, cappedByCapacity: false, formula };
  }
  const dailyBudget = monthlyRevenueGoal / revPerDollar;
  const conversationsNeeded = convPerDollar === null ? null : convPerDollar * dailyBudget;
  const capacityPerMonth = isNum(weeklyCapacity) && weeklyCapacity > 0 ? weeklyCapacity * (TIME.daysPerMonth.value / 7) : null;
  let capped = dailyBudget;
  let cappedByCapacity = false;
  if (capacityPerMonth !== null && conversationsNeeded !== null && convPerDollar && conversationsNeeded > capacityPerMonth) {
    capped = capacityPerMonth / convPerDollar;
    cappedByCapacity = true;
  }
  return { dailyBudget, cappedDailyBudget: capped, conversationsNeeded, capacityPerMonth, cappedByCapacity, formula };
}

// ---------- Google mode: Ahrefs CPC conversion ----------

/** Ahrefs returns CPC in USD cents. Returns null when no rate is set (never guesses a rate). */
export function convertCpcCents(cents: number, usdToLocal: number | null, currency: string): number | null {
  if (currency === "USD") return cents / 100;
  if (usdToLocal === null) return null;
  return (cents / 100) * usdToLocal;
}
