import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
// Separate from data/pglite so e2e runs never touch (or lock) the dev database.
const DATABASE_DIR = path.join(__dirname, "data", "e2e-pglite");

export default defineConfig({
  testDir: "./e2e",
  // Specs share one seeded database and some of them decide refunds, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  // A retried decision test would find its refund already decided, so retries wouldn't help.
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // `next dev` compiles each route on first visit, which can take a while.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx tsx e2e/prepare-db.ts && npx next dev --port ${PORT}`,
    url: BASE_URL,
    env: { DATABASE_DIR, NEXT_DIST_DIR: ".next-e2e", NEXT_TELEMETRY_DISABLED: "1" },
    // Always start a fresh server so every run begins from a freshly seeded database.
    reuseExistingServer: false,
    timeout: 180_000,
    stderr: "pipe",
  },
});
