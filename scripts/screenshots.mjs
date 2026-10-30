// Dev helper: onboards a sample workspace and screenshots every page at a laptop size.
// Usage: node scripts/screenshots.mjs <output-dir> [base-url]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "screenshots";
const base = process.argv[3] ?? `http://localhost:${process.env.PORT ?? 5173}`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1150, height: 940 } });
await page.goto(base);
await page.getByRole("button", { name: /Start my workbook/ }).click();
await page.getByRole("button", { name: "I understand, let's start" }).click();
await page.screenshot({ path: `${out}/00-onboarding.png` });
await page.getByLabel("Business name").fill("Sample Workshop Co");
await page.getByText("I don't have a website yet").click();
await page.getByRole("button", { name: "Next" }).click();
await page.getByRole("radio", { name: /^Coaching and consulting/ }).check();
await page.getByRole("button", { name: "Next" }).click();
await page.getByLabel("What do you sell?").fill("A 2-day content workshop for business owners");
await page.getByRole("button", { name: "Next" }).click();
await page.getByRole("radio", { name: /Locally,\ in\ a\ service\ area/ }).check();
await page.getByLabel("Main city or service area").fill("Perth");
await page.getByRole("button", { name: "Next" }).click();
await page.getByRole("radio", { name: /More\ enquiries\ or\ calls\ booked/ }).check();
await page.getByRole("button", { name: "Next" }).click();
await page.getByRole("radio", { name: /Nothing\ yet/ }).check();
await page.getByRole("radio", { name: /Not\ sure/ }).check();
await page.getByRole("button", { name: "Next" }).click();
await page.getByRole("button", { name: "Start the workbook" }).click();
await page.waitForURL(/three-cs/);

const id = await page.evaluate(() => localStorage.getItem("pmw_workspace"));
const answers = { c3_awareness: "not_searching", fc_funnel: "2step", fc_daily_budget: 50, fc_offer_price: 2500, fc_cpm: 40, fc_ctr: 0.01, fc_optin: 0.07, fc_booking: 0.3, fc_show: 0.7, fc_close: 0.3, vsl_type: "story_arc" };
await page.request.put(`${base}/api/workspaces/${id}/answers`, { data: { answers: Object.entries(answers).map(([field_id, value]) => ({ field_id, value })) } });

const sections = ["three-cs", "forecasting", "ten-principles", "customer-avatar", "messaging", "landing-page", "build-funnel", "ad-principles", "filming-ads", "vsl", "meta-campaign", "audiences", "sales", "optimising"];
for (const [i, s] of sections.entries()) {
  await page.goto(`${base}/workbook/${s}`);
  await page.waitForSelector("article h1");
  await page.waitForTimeout(250);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, "0")}-${s}.png` });
  console.log(`${s}: page height ${h}px (${(h / 940).toFixed(2)} screens)`);
}
await page.goto(`${base}/`);
await page.waitForSelector(".hero h1");
await page.screenshot({ path: `${out}/99-home.png` });
await page.goto(`${base}/plan`);
await page.waitForSelector("main h1");
await page.screenshot({ path: `${out}/98-plan.png` });
await browser.close();
