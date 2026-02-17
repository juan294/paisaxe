import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

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
    baseURL: "http://localhost:3000",
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
    command: isCI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
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
