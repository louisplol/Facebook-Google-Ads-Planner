import { test, expect } from "@playwright/test";
import { onboard, putAnswers, goSection } from "./helpers.ts";

test("onboarding to chosen headline, and refresh keeps every answer", async ({ page }) => {
  await onboard(page, { company: "Headline Co", industry: "Coaching and consulting" });
  await page.getByRole("radio", { name: /don't fully recognise it yet/ }).check();
  await expect(page.getByRole("heading", { name: "Meta Ads" })).toBeVisible();

  await goSection(page, "messaging");
  await page.getByLabel("The Thing", { exact: true }).fill("A 2-day workshop");
  await page.getByLabel("Your chosen headline").fill("Go from invisible to booked out");
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByLabel("Your chosen headline")).toHaveValue("Go from invisible to booked out");
  await expect(page.getByLabel("The Thing", { exact: true })).toHaveValue("A 2-day workshop");
});

test("forecaster shows golden case 1 and correct colours", async ({ page }) => {
  await onboard(page, { company: "Forecast Co", industry: "Coaching and consulting" });
  await goSection(page, "forecasting");
  await page.getByRole("radio", { name: /^2-Step Funnel/ }).check();
  const fill = async (label: string, v: string) => page.getByLabel(label, { exact: true }).fill(v);
  await fill("Daily Ad Budget", "50");
  await fill("Offer Price", "2500");
  await fill("CPM", "40");
  await fill("Link CTR", "1");
  await fill("Opt-in Rate", "7");
  await fill("Booking Rate", "30");
  await fill("Show Rate", "70");
  await fill("Close Rate", "30");
  const row = (name: string) => page.locator("tr", { has: page.locator("td", { hasText: new RegExp(`^${name}`) }) }).first();
  await expect(row("Ad spend")).toContainText("$1,520");
  await expect(row("Ad spend")).toContainText("$18,250");
  await expect(row("Impressions")).toContainText("38,000");
  await expect(row("Clicks")).toContainText("380.0");
  await expect(row("Clicks")).toContainText("$4.00");
  await expect(row("Leads")).toContainText("26.6");
  await expect(row("Leads")).toContainText("$57.14");
  await expect(row("Bookings")).toContainText("$190.48");
  await expect(row("Conversations")).toContainText("5.6");
  await expect(row("Deals")).toContainText("$907.03");
  await expect(row("Revenue")).toContainText("$4,190");
  await expect(row("Revenue")).toContainText("$50,274");
  await expect(row("ROAS")).toContainText("2.8x");
  for (const l of ["CPM", "Link CTR", "Opt-in Rate", "Booking Rate", "Show Rate", "Close Rate"]) await expect(page.getByLabel(l, { exact: true })).toHaveClass(/dial-green/);
  await fill("Show Rate", "50");
  await expect(page.getByLabel("Show Rate", { exact: true })).toHaveClass(/dial-red/);
});

test("full run reaches Ready to launch; checklists persist", async ({ page }) => {
  await onboard(page, { company: "Launch Co", industry: "Coaching and consulting" });
  const ideas = Array.from({ length: 12 }, (_, i) => ({ idea: `Idea ${i + 1}`, source: "", hook: `Hook ${i + 1}` }));
  await putAnswers(page, {
    fc_daily_budget: 50,
    msg_headline_chosen: "Booked out",
    lp_headline: "Booked out",
    ap_ideas: ideas,
    ap_check_all: { passed: true, ideaCount: 12, pairs: [] },
    fa_scripts: ideas.map((i) => ({ hook: i.hook, prove: "Story", cta: "Click below to learn more.", status: "scripted" })),
    lp_tracking: { checkedAt: new Date().toISOString(), passed: true, pages: {} },
  });

  await goSection(page, "build-funnel");
  for (const n of [6, 7, 8]) await page.getByRole("checkbox").nth(n - 1).check();
  await goSection(page, "meta-campaign");
  for (const l of ["Advantage+ audience is on", "Optimised Creative Text is off", "Relevant Comments is off", "Related Media is off", "Image Generation is off"]) await page.getByText(l).click();
  await expect(page.getByRole("heading", { name: "Ready to launch" })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ready to launch" })).toBeVisible();

  // The check reflects real state: unticking one item makes it not ready.
  await page.getByText("Image Generation is off").click();
  await expect(page.getByRole("heading", { name: "Not ready yet" })).toBeVisible();
});

test("Optimising matches golden case 2", async ({ page }) => {
  await onboard(page, { company: "Optimise Co", industry: "Coaching and consulting" });
  await goSection(page, "optimising");
  // CTR 2.5%, opt-in 4%, booking 35%, show 60%, close 20%
  const set = async (l: string, v: string) => page.getByLabel(l, { exact: true }).fill(v);
  await page.getByText("Numbers for this review (7-14 days)").click();
  await set("Impressions", "10000");
  await set("Link clicks", "250");
  await set("Leads", "10");
  await set("Bookings", "3.5");
  await set("Shows", "2.1");
  await set("Deals", "0.42");
  // Row 2 is "Fix this first"; rows 3, 5 and 6 are "After that".
  await expect(page.locator(".bn-row.first .bn-chip")).toHaveText("CTR > 2% but poor opt-in");
  await expect(page.locator(".bn-row.later .bn-chip")).toHaveText(["Opt-in < 5%", "Show rate < 65%", "Close rate < 25%"]);

  await page.getByLabel("Target cost per result").fill("57.14");
  const csv = "Ad name,Ad set name,Amount spent (AUD),Results,Cost per result,Frequency\nD,Cold,300,8,37.5,1.6\nA,Cold,180,0,,1.4\nB,Cold,120,0,,1.2\nE,Cold,90,1,90,2.4\nF,Warm,60,1,60,2.6\nC,Cold,40,2,20,1.1\n";
  await page.getByLabel("Results per ad (CSV from Ads Manager)").setInputFiles({ name: "ads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.locator("select").filter({ hasText: "Cold" }).nth(1).selectOption("warm");
  const rows = page.locator("table").last().locator("tbody tr");
  await expect(rows).toHaveCount(6);
  const expected = [
    ["D", "Winner"],
    ["A", "Pause"],
    ["B", "Consider pausing"],
    ["E", "Tired"],
    ["F", ""],
    ["C", "Leave it"],
  ];
  for (const [i, [name, flag]] of expected.entries()) {
    await expect(rows.nth(i).locator("td").first()).toHaveText(name);
    if (flag) await expect(rows.nth(i).locator(".tag")).toHaveText(flag);
    else await expect(rows.nth(i).locator(".tag")).toHaveCount(0);
  }
});

test("a trades user gets the 1-step funnel and reaches results", async ({ page }) => {
  await onboard(page, { company: "Sparky Co", industry: "Trades and home services" });
  await goSection(page, "forecasting");
  await expect(page.getByLabel("Booking Rate", { exact: true })).toHaveCount(0);
  for (const [l, v] of [["Daily Ad Budget", "40"], ["Offer Price", "600"], ["CPM", "30"], ["Link CTR", "1.5"], ["Opt-in Rate", "10"], ["Show Rate", "80"], ["Close Rate", "40"]] as const)
    await page.getByLabel(l, { exact: true }).fill(v);
  await expect(page.locator("tr", { hasText: "Revenue" }).first()).toContainText("$");
  await expect(page.getByPlaceholder(/Booked three weeks ahead/).first()).toHaveCount(0);
  await goSection(page, "messaging");
  // Draft 1 and the chosen headline both show the trades example.
  await expect(page.getByPlaceholder("e.g. Booked three weeks ahead without chasing quotes")).toHaveCount(2);
  await expect(page.getByLabel("Idea 1")).toHaveCount(0);
  await goSection(page, "ad-principles");
  await expect(page.getByLabel("Idea 12")).toHaveAttribute("placeholder", "e.g. Power points in all the wrong places in a new home");
});

test("a health user has the Google Review VSL hidden", async ({ page }) => {
  await onboard(page, { company: "Physio Co", industry: "Health and wellness" });
  await goSection(page, "vsl");
  await expect(page.getByText("Feedback Story Arc VSL")).toBeVisible();
  await expect(page.getByText("Google Review VSL")).toHaveCount(0);
});

test("a software user gets the archetype funnel", async ({ page }) => {
  await onboard(page, { company: "SaaS Co", industry: "Software", sellMode: "Online, as a service or program" });
  await goSection(page, "forecasting");
  await expect(page.getByRole("heading", { name: "Software funnel" })).toBeVisible();
  for (const [l, v] of [["Daily Ad Budget", "50"], ["Offer Price", "100"], ["CPM", "70"], ["Link CTR", "1"], ["Opt-in Rate", "10"], ["Booking Rate", "40"], ["Show Rate", "70"], ["Close Rate", "30"]] as const)
    await page.getByLabel(l, { exact: true }).fill(v);
  await page.getByLabel("Visitor to signup rate").fill("10");
  await page.getByLabel("Signup to activated rate").fill("50");
  await page.getByLabel("Activated to paid rate").fill("20");
  await page.getByLabel("Monthly revenue per account").fill("100");
  await expect(page.getByText(/New monthly recurring revenue/)).toBeVisible();
});

test("admin without Access returns 403", async ({ request }) => {
  expect((await request.get("/api/admin/overview")).status()).toBe(403);
  expect((await request.get("/api/admin/workspaces")).status()).toBe(403);
});

test("mobile: the sidebar becomes a section picker", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await onboard(page, { company: "Phone Co", industry: "Other" });
  await page.getByLabel("Go to section").selectOption("sales");
  await expect(page).toHaveURL(/\/workbook\/sales/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
