import { describe, it, expect } from "vitest";
import {
  forecast,
  forecastColours,
  biggestDial,
  workBackwards,
  convertCpcCents,
  requiredInputs,
  colourForBand,
  colourForCpm,
  cpmTypical,
  type ForecastInputs,
} from "../src/calc/forecast.ts";
import { formatForecastCell, formatCostEach, formatMoney, formatPercent, formatRoas, formatCount } from "../src/calc/format.ts";
import { FORECAST_BENCHMARKS } from "../src/config/benchmarks.ts";

// Golden case 1, from the reference screenshot.
const golden1: ForecastInputs = {
  funnel: "2step",
  dailyBudget: 50,
  offerPrice: 2500,
  cpm: 40,
  ctr: 0.01,
  optin: 0.07,
  booking: 0.3,
  show: 0.7,
  close: 0.3,
};

const cell = (r: ReturnType<typeof forecast>, key: string, p: "monthly" | "annual") => {
  const l = r.byKey[key];
  return formatForecastCell(key, l.kind, p, l[p]);
};

describe("golden case 1 (matches the reference to the cent)", () => {
  const r = forecast(golden1);
  it("is complete", () => {
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });
  it("ad spend", () => {
    expect(cell(r, "spend", "monthly")).toBe("$1,520");
    expect(cell(r, "spend", "annual")).toBe("$18,250");
  });
  it("impressions", () => {
    expect(cell(r, "impressions", "monthly")).toBe("38,000");
    expect(cell(r, "impressions", "annual")).toBe("456,000");
  });
  it("clicks", () => {
    expect(cell(r, "clicks", "monthly")).toBe("380.0");
    expect(cell(r, "clicks", "annual")).toBe("4,560");
    expect(formatCostEach(r.byKey.clicks.costEach)).toBe("$4.00");
  });
  it("leads", () => {
    expect(cell(r, "leads", "monthly")).toBe("26.6");
    expect(cell(r, "leads", "annual")).toBe("319");
    expect(formatCostEach(r.byKey.leads.costEach)).toBe("$57.14");
  });
  it("bookings", () => {
    expect(cell(r, "bookings", "monthly")).toBe("8.0");
    expect(cell(r, "bookings", "annual")).toBe("96");
    expect(formatCostEach(r.byKey.bookings.costEach)).toBe("$190.48");
  });
  it("conversations", () => {
    expect(cell(r, "conversations", "monthly")).toBe("5.6");
    expect(cell(r, "conversations", "annual")).toBe("67");
  });
  it("deals", () => {
    expect(cell(r, "deals", "monthly")).toBe("1.7");
    expect(cell(r, "deals", "annual")).toBe("20");
    expect(formatCostEach(r.byKey.deals.costEach)).toBe("$907.03");
  });
  it("revenue", () => {
    expect(cell(r, "revenue", "monthly")).toBe("$4,190");
    expect(cell(r, "revenue", "annual")).toBe("$50,274");
    expect(r.byKey.revenue.monthly).toBeCloseTo(4189.5, 6);
  });
  it("roas", () => {
    expect(cell(r, "roas", "monthly")).toBe("2.8x");
  });
  it("every line shows its formula and inputs", () => {
    for (const l of r.lines) {
      expect(l.formula.length).toBeGreaterThan(5);
      expect(Object.keys(l.inputs).length).toBeGreaterThan(0);
    }
  });
  it("colours are all green", () => {
    expect(forecastColours(golden1, "b2c")).toEqual({ cpm: "green", ctr: "green", optin: "green", booking: "green", show: "green", close: "green" });
  });
});

describe("forecast edge cases", () => {
  it("missing inputs return null with a prompt, never zero", () => {
    const r = forecast({ funnel: "2step", dailyBudget: 50, offerPrice: null, cpm: 40, ctr: null, optin: 0.07, booking: 0.3, show: 0.7, close: 0.3 });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["Offer Price", "Link CTR"]);
    expect(r.byKey.clicks.monthly).toBeNull();
    expect(r.byKey.revenue.monthly).toBeNull();
    expect(r.byKey.spend.monthly).toBeCloseTo(1520);
    expect(r.byKey.clicks.costEach).toBeNull();
  });
  it("a zero rate shows none yet for every cost each below it", () => {
    const r = forecast({ ...golden1, optin: 0 });
    expect(r.byKey.leads.costEach).toBe("none_yet");
    expect(r.byKey.bookings.costEach).toBe("none_yet");
    expect(r.byKey.deals.costEach).toBe("none_yet");
    expect(formatCostEach(r.byKey.deals.costEach)).toBe("none yet");
    expect(r.byKey.clicks.costEach).toBeCloseTo(4);
  });
  it("1-step skips booking", () => {
    const r = forecast({ ...golden1, funnel: "1step", booking: null });
    expect(r.ok).toBe(true);
    expect(r.byKey.bookings).toBeUndefined();
    expect(r.byKey.conversations.monthly).toBeCloseTo(26.6 * 0.7);
    expect(requiredInputs("1step")).not.toContain("booking");
  });
  it("checkout funnel uses purchase rate", () => {
    const r = forecast({ funnel: "checkout", dailyBudget: 50, offerPrice: 100, cpm: 40, ctr: 0.01, optin: null, purchase: 0.02 });
    expect(r.ok).toBe(true);
    expect(r.byKey.deals.monthly).toBeCloseTo(7.6);
    expect(r.byKey.revenue.monthly).toBeCloseTo(760);
    expect(r.byKey.revenue.formula).toMatch(/average order value/);
    expect(forecastColours({ funnel: "checkout", cpm: 40, ctr: 0.01, dailyBudget: 1, offerPrice: 1, optin: null })).toEqual({ cpm: "green", ctr: "green" });
  });
  it("google mode uses cost per click", () => {
    const r = forecast({ ...golden1, channel: "google", cpm: null, ctr: null, cpc: 4 });
    expect(r.ok).toBe(true);
    expect(r.byKey.impressions).toBeUndefined();
    expect(r.byKey.clicks.monthly).toBeCloseTo(380);
    expect(r.byKey.revenue.monthly).toBeCloseTo(4189.5);
    expect(requiredInputs("2step", "google")).toContain("cpc");
    expect(forecastColours({ ...golden1, channel: "google" }).ctr).toBeUndefined();
  });
  it("google mode with zero cost per click gives no clicks", () => {
    const r = forecast({ ...golden1, channel: "google", cpc: 0 });
    expect(r.byKey.clicks.monthly).toBeNull();
  });
  it("gross profit and roas", () => {
    const r = forecast({ ...golden1, margin: 0.6 });
    expect(r.grossProfit).toBeCloseTo(4189.5 * 0.6 - 1520);
    expect(r.byKey.grossProfit.annual).toBeCloseTo((4189.5 * 0.6 - 1520) * 12);
    expect(r.roas).toBeCloseTo(4189.5 / 1520);
  });
  it("zero budget gives no roas", () => {
    const r = forecast({ ...golden1, dailyBudget: 0 });
    expect(r.roas).toBeNull();
  });
});

describe("colours", () => {
  it("bands", () => {
    const b = FORECAST_BENCHMARKS.ctr.value;
    expect(colourForBand(0.005, b)).toBe("red");
    expect(colourForBand(0.015, b)).toBe("green");
    expect(colourForBand(0.03, b)).toBe("gold");
    expect(colourForBand(null, b)).toBe("none");
    expect(colourForBand(0.5, { low: 0.4, high: null, hint: "" })).toBe("green");
    expect(colourForBand(0.3, { low: 0.4, high: null, hint: "", inverted: true })).toBe("green");
    expect(colourForBand(0.5, { low: 0.4, high: null, hint: "", inverted: true })).toBe("red");
  });
  it("show rate red below 65%", () => {
    expect(colourForBand(0.6, FORECAST_BENCHMARKS.show.value)).toBe("red");
    expect(colourForBand(0.72, FORECAST_BENCHMARKS.show.value)).toBe("gold");
  });
  it("cpm is inverted", () => {
    expect(colourForCpm(35, "b2c")).toBe("green");
    expect(colourForCpm(45, "b2c")).toBe("red");
    expect(colourForCpm(65, "b2b")).toBe("green");
    expect(colourForCpm(null, "b2b")).toBe("none");
    expect(cpmTypical("both")).toBe(40);
  });
});

describe("biggest dial", () => {
  it("ranks by headroom to benchmark midpoint", () => {
    const ranks = biggestDial(golden1);
    expect(ranks[0].key).toBe("optin");
    // opt-in 7% to 12.5% midpoint: 4189.5 x (12.5/7 - 1)
    expect(ranks[0].revenueGain).toBeCloseTo(4189.5 * (0.125 / 0.07 - 1), 4);
    expect(ranks.find((r) => r.key === "show")!.revenueGain).toBe(0);
    // Headroom: opt-in x0.786, CTR x0.5, booking x0.333, close x0.25, show 0
    expect(ranks.map((r) => r.key)).toEqual(["optin", "ctr", "booking", "close", "show"]);
  });
  it("returns nothing when inputs are missing", () => {
    expect(biggestDial({ ...golden1, close: null })).toEqual([]);
  });
  it("skips a zero rate", () => {
    expect(biggestDial({ ...golden1, optin: 0 }).map((x) => x.key)).not.toContain("optin");
  });
  it("skips zero rates and handles 1-step", () => {
    const r = biggestDial({ ...golden1, funnel: "1step", booking: null, ctr: 0.01 });
    expect(r.map((x) => x.key)).not.toContain("booking");
  });
});

describe("work backwards", () => {
  it("returns the daily budget for a revenue goal", () => {
    const r = workBackwards(golden1, 8379);
    expect(r.dailyBudget).toBeCloseTo(100, 6);
    expect(r.cappedByCapacity).toBe(false);
  });
  it("caps by weekly capacity", () => {
    const r = workBackwards(golden1, 41895, 5);
    // 1000/day needed; 111.72 conversations a month; capacity 5 x 30.4/7 = 21.71
    expect(r.dailyBudget).toBeCloseTo(500, 6);
    expect(r.cappedByCapacity).toBe(true);
    expect(r.capacityPerMonth).toBeCloseTo(21.714, 2);
    expect(r.cappedDailyBudget!).toBeCloseTo(21.7142857 / (5.586 / 50), 3);
  });
  it("returns nulls without rates", () => {
    expect(workBackwards({ ...golden1, close: null }, 1000).dailyBudget).toBeNull();
    expect(workBackwards(golden1, 0).dailyBudget).toBeNull();
  });
});

describe("google cost per click conversion", () => {
  it("converts USD cents at the config rate, never guessing", () => {
    expect(convertCpcCents(250, null, "USD")).toBe(2.5);
    expect(convertCpcCents(250, null, "AUD")).toBeNull();
    expect(convertCpcCents(250, 1.5, "AUD")).toBeCloseTo(3.75);
  });
});

describe("format", () => {
  it("formats values", () => {
    expect(formatMoney(-12.5, "AUD", 2)).toBe("-$12.50");
    expect(formatMoney(10, "GBP")).toBe("£10");
    expect(formatMoney(10, "EUR")).toBe("€10");
    expect(formatMoney(10, "JPY")).toBe("10 JPY");
    expect(formatMoney(null)).toBe("");
    expect(formatPercent(0.01)).toBe("1%");
    expect(formatPercent(0.025)).toBe("2.5%");
    expect(formatPercent(null)).toBe("");
    expect(formatRoas(null)).toBe("");
    expect(formatCount(undefined, 1)).toBe("");
    expect(formatCostEach(null)).toBe("");
    expect(formatForecastCell("x", "count", "monthly", null)).toBe("");
  });
});
