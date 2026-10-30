import { expect, type Page } from "@playwright/test";

/** Onboards a new workspace through the UI with "I don't have a website yet". */
export async function onboard(page: Page, opts: { company: string; industry: string; sellMode?: string; offer?: string }) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start my workbook" }).click();
  await page.getByRole("button", { name: "I understand, let's start" }).click();
  await page.getByLabel("Business name").fill(opts.company);
  await page.getByText("I don't have a website yet").click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: new RegExp(`^${opts.industry}`) }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("What do you sell?").fill(opts.offer ?? "A test offer");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: new RegExp(opts.sellMode ?? "Locally, in a service area") }).check();
  await page.getByLabel("Main city or service area").fill("Brisbane");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: /More\ enquiries\ or\ calls\ booked/ }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: /Nothing\ yet/ }).check();
  await page.getByRole("radio", { name: /Not\ sure/ }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Here's what we found" })).toBeVisible();
  await page.getByRole("button", { name: "Start the workbook" }).click();
  await expect(page).toHaveURL(/\/workbook\/three-cs/);
}

export async function workspaceId(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem("pmw_workspace") as string);
}

/** Saves answers directly through the app's own route (same as typing, faster). */
export async function putAnswers(page: Page, answers: Record<string, unknown>) {
  const id = await workspaceId(page);
  const res = await page.request.put(`/api/workspaces/${id}/answers`, { data: { answers: Object.entries(answers).map(([field_id, value]) => ({ field_id, value })) } });
  expect(res.ok()).toBeTruthy();
}

export async function goSection(page: Page, id: string) {
  await page.goto(`/workbook/${id}`);
  await expect(page.locator("article h1")).toBeVisible();
}
