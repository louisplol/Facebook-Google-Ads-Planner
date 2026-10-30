import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

// Signs in to the local admin with the dev token from .dev.vars and opens every page.
const token = existsSync(".dev.vars") ? (/^ADMIN_DEV_TOKEN=(.+)$/m.exec(readFileSync(".dev.vars", "utf8"))?.[1]?.trim() ?? "") : "";

test("admin asks for the token, then shows every page", async ({ page }) => {
  test.skip(!token, "no local admin token");
  await page.goto("/admin");
  await page.getByLabel("Admin token").fill("wrong-token-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That token didn't work.")).toBeVisible();
  await page.getByLabel("Admin token").fill(token);
  await page.getByRole("button", { name: "Sign in" }).click();
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav).toBeVisible();
  for (const link of await nav.getByRole("link").all()) {
    await link.click();
    await expect(page.locator(".error")).toHaveCount(0);
  }
  await page.goto("/admin/workspaces");
  await page.locator("a[href^='/admin/workspaces/']").first().click();
  await expect(page.locator(".error")).toHaveCount(0);
});
