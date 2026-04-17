import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const useDevServer = process.env.PLAYWRIGHT_USE_DEV_SERVER === "true";
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "true";
const e2ePort = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://localhost:${e2ePort}`;

function getWebServerCommand() {
  if (isCI) return `npm run start -- --port ${e2ePort}`;
  if (useDevServer) return `npm run dev -- --port ${e2ePort}`;
  return `npm run build && npm run start -- --port ${e2ePort}`;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["html"], ["github"]] : [["html"]],
  timeout: isCI ? 15_000 : 30_000,

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: "disabled",
    },
  },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: isCI ? "off" : "retain-on-failure",
    storageState: "e2e/storage-state.json",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/qa-journey.spec.ts", "**/visual-regression.spec.ts"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: ["**/qa-journey.spec.ts", "**/visual-regression.spec.ts"],
    },
    {
      name: "qa-journey",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "qa-journey.spec.ts",
      timeout: 30_000,
    },
    {
      name: "visual-desktop",
      use: { ...devices["Desktop Chrome"], locale: "en-US" },
      testMatch: "visual-regression.spec.ts",
    },
    {
      name: "visual-mobile",
      use: { ...devices["Pixel 7"], locale: "en-US" },
      testMatch: "visual-regression.spec.ts",
    },
  ],

  webServer: {
    command: getWebServerCommand(),
    url: baseURL,
    // Default local runs to an isolated production-style server because next dev's
    // issues overlay can intercept mobile clicks and hide real regressions.
    reuseExistingServer,
    timeout: 120_000,
    // Wait for server to be fully ready before running tests (reduces flaky visual regression)
    ...(isCI && { stdout: "pipe" }),
    env: {
      ANTHROPIC_API_KEY: "dummy_key_for_e2e",
      VOYAGE_API_KEY: "dummy_key_for_e2e",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy_key_for_e2e",
      MAINTENANCE_MODE: "false",
      STRIPE_SECRET_KEY: "sk_test_dummy_for_e2e",
      STRIPE_DAY_PASS_PRICE_ID: "price_test_dummy_for_e2e",
    },
  },
});
