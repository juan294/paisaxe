import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["html"], ["github"]] : [["html"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "qa-journey",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "qa-journey.spec.ts",
    },
  ],

  webServer: {
    command: isCI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120_000,
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
