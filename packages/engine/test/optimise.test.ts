import { describe, it, expect } from "vitest";
import { evaluateBottlenecks, applyPlaybook, ratesFromActuals, median, importAdsCsv, parseCsv, nextReviewDate, tooSoonToJudge, FLAG_LABELS, type AdRow } from "../src/calc/optimise.ts";
import { closeOptions } from "../src/calc/sales.ts";
import { softwareForecast, unitEconomics } from "../src/calc/saas.ts";

describe("golden case 2: bottlenecks", () => {
  it("fix this first is row 2; after that rows 3, 5 and 6", () => {
    const r = evaluateBottlenecks({ ctr: 0.025, optin: 0.04, booking: 0.35, show: 0.6, close: 0.2 });
    expect(r.first?.id).toBe(2);
    expect(r.afterThat.map((x) => x.id)).toEqual([3, 5, 6]);
  });
  it("row 1 when CTR under 1%", () => {
    const r = evaluateBottlenecks({ ctr: 0.005, optin: 0.1, booking: 0.2, show: 0.8, close: 0.3 });
    expect(r.first?.id).toBe(1);
    expect(r.afterThat.map((x) => x.id)).toEqual([4]);
  });
  it("nothing triggered", () => {
    const r = evaluateBottlenecks({ ctr: 0.015, optin: 0.1, booking: 0.4, show: 0.7, close: 0.3 });
    expect(r.first).toBeNull();
    expect(r.triggered).toEqual([]);
  });
  it("unknown rates never trigger", () => {
    expect(evaluateBottlenecks({ ctr: null, optin: null, booking: null, show: null, close: null }).first).toBeNull();
  });
  it("rates from actuals", () => {
    const r = ratesFromActuals({ impressions: 10000, clicks: 250, leads: 10, bookings: 4, shows: 3, deals: 1 });
    expect(r).toEqual({ ctr: 0.025, optin: 0.04, booking: 0.4, show: 0.75, close: 1 / 3 });
    const one = ratesFromActuals({ clicks: 100, leads: 10, shows: 5, deals: 1 }, "1step");
    expect(one.booking).toBeNull();
    expect(one.show).toBe(0.5);
    expect(one.ctr).toBeNull();
  });
});

describe("golden case 2: playbook", () => {
  const ads: AdRow[] = [
    { name: "A", adSet: "Cold", spent: 180, results: 0, frequency: 1.4 },
    { name: "B", adSet: "Cold", spent: 120, results: 0, frequency: 1.2 },
    { name: "C", adSet: "Cold", spent: 40, results: 2, costPerResult: 20, frequency: 1.1 },
    { name: "D", adSet: "Cold", spent: 300, results: 8, costPerResult: 37.5, frequency: 1.6 },
    { name: "E", adSet: "Cold", spent: 90, results: 1, costPerResult: 90, frequency: 2.4 },
    { name: "F", adSet: "Warm", spent: 60, results: 1, costPerResult: 60, frequency: 2.6 },
  ];
  const r = applyPlaybook(ads, 57.14, { Cold: "cold", Warm: "warm" });
  it("median spend is $105", () => expect(r.medianSpend).toBe(105));
  it("sorts by spend, highest first", () => expect(r.ads.map((a) => a.name)).toEqual(["D", "A", "B", "E", "F", "C"]));
  it("flags match the expected table", () => {
    expect(r.ads.map((a) => a.flag)).toEqual(["winner", "pause", "consider_pausing", "tired", "none", "leave_it"]);
    expect(r.ads[1].multipleOfTarget!.toFixed(2)).toBe("3.15");
    expect(r.ads[2].multipleOfTarget!.toFixed(2)).toBe("2.10");
    expect(FLAG_LABELS[r.ads[1].flag]).toBe("Pause");
  });
  it("unknown ad sets default to cold", () => {
    const x = applyPlaybook([{ name: "Z", adSet: "New", spent: 10, results: 1, frequency: 3 }], 50, {});
    expect(x.ads[0].temp).toBe("cold");
    expect(x.ads[0].flag).toBe("tired");
    expect(x.ads[0].cpr).toBe(10);
  });
  it("zero target never divides by zero", () => {
    const x = applyPlaybook([{ name: "Z", adSet: "", spent: 10, results: 0 }], 0, {});
    expect(x.ads[0].multipleOfTarget).toBeNull();
  });
});

describe("median", () => {
  it("odd and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBe(0);
  });
});

describe("csv import", () => {
  it("reads an Ads Manager export", () => {
    const csv = '﻿Ad name,Ad set name,Amount spent (AUD),Results,Cost per result,"CTR (link click-through rate)",Frequency,Impressions\n"Hook, v1",Cold,180.00,0,,1.25,1.4,9000\nB,Warm,"$1,120.50",3,373.5,2%,2.1,20000\nTotal,,,,,,,\n';
    const { ads, errors } = importAdsCsv(csv);
    expect(errors).toEqual([]);
    expect(ads).toHaveLength(2);
    expect(ads[0]).toMatchObject({ name: "Hook, v1", adSet: "Cold", spent: 180, results: 0, costPerResult: null, ctr: 0.0125, frequency: 1.4, impressions: 9000 });
    expect(ads[1].spent).toBe(1120.5);
    expect(ads[1].ctr).toBe(0.02);
  });
  it("reports missing columns", () => {
    expect(importAdsCsv("foo,bar\n1,2").errors.length).toBeGreaterThan(0);
    expect(importAdsCsv("").errors).toEqual(["The file has no rows."]);
  });
  it("parses quotes and CRLF", () => {
    expect(parseCsv('a,"b ""q""",c\r\n1,2,3')).toEqual([["a", 'b "q"', "c"], ["1", "2", "3"]]);
  });
  it("handles short rows", () => {
    expect(importAdsCsv("Ad name,Amount spent,Results\nY,5").ads[0].results).toBe(0);
  });
  it("handles minimal columns", () => {
    const { ads } = importAdsCsv("Ad name,Amount spent,Results\nX,-,");
    expect(ads[0]).toMatchObject({ name: "X", spent: 0, results: 0, adSet: "", ctr: null, frequency: null });
  });
});

describe("review cadence", () => {
  it("next review 7 days after import, too soon before that", () => {
    const d = new Date("2026-10-01T00:00:00Z");
    expect(nextReviewDate(d).toISOString()).toBe("2026-10-08T00:00:00.000Z");
    expect(tooSoonToJudge(d, new Date("2026-10-05T00:00:00Z"))).toBe(true);
    expect(tooSoonToJudge(d, new Date("2026-10-09T00:00:00Z"))).toBe(false);
    expect(tooSoonToJudge(null, d)).toBe(false);
  });
});

describe("sales close options", () => {
  it("computes from offer price and uplift", () => {
    const r = closeOptions(3000, 0.1);
    expect(r.onePayment).toBe(3000);
    expect(r.monthly).toBeCloseTo(1100);
  });
  it("blank uplift leaves monthly blank", () => {
    expect(closeOptions(3000, null).monthly).toBeNull();
    expect(closeOptions(null, 0.1).onePayment).toBeNull();
    expect(closeOptions(3000, 0).monthly).toBe(1000);
  });
});

describe("software", () => {
  it("self serve stages", () => {
    const r = softwareForecast("self_serve", 50, 380, { signups: 0.1, activated: 0.5, paid: 0.2 }, 100);
    expect(r.newCustomers).toBeCloseTo(3.8);
    expect(r.newMrr).toBeCloseTo(380);
    expect(r.cac).toBeCloseTo(1520 / 3.8);
    expect(r.lines.map((l) => l.key)).toEqual(["entry", "signups", "activated", "paid"]);
  });
  it("sales led with a missing rate", () => {
    const r = softwareForecast("sales_led", null, 20, { qualified: 0.5, meetings: null }, null);
    expect(r.newCustomers).toBeNull();
    expect(r.cac).toBeNull();
    expect(r.newMrr).toBeNull();
  });
  it("zero customers is none yet", () => {
    expect(softwareForecast("self_serve", 10, 0, { signups: 0.1, activated: 1, paid: 1 }, 10).cac).toBe("none_yet");
  });
  it("unit economics", () => {
    const u = unitEconomics(100, 0.8, 0.04, 400);
    expect(u.ltv).toBeCloseTo(2000);
    expect(u.paybackMonths).toBeCloseTo(5);
    expect(u.ltvToCac).toBeCloseTo(5);
    expect(unitEconomics(null, 0.8, 0.04, 400).ltv).toBeNull();
    expect(unitEconomics(100, 0.8, 0, 0).ltvToCac).toBeNull();
  });
});
