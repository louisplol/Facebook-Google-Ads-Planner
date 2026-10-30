import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the local dev server. Assists and research are not connected
// in these runs (no keys), so the method is tested on its own, as the plan requires.
const base = `http://localhost:${process.env.PORT ?? 5173}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: base, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: `${base}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
