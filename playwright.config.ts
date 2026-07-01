import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const useDevServer = process.env.PLAYWRIGHT_USE_DEV_SERVER === "true";
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER !== "false";
const e2ePort = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://localhost:${e2ePort}`;
const chromeChannel = process.env.PLAYWRIGHT_CHROME_CHANNEL;
const desktopChrome = {
  ...devices["Desktop Chrome"],
  ...(chromeChannel ? { channel: chromeChannel } : {}),
};
const mobileChrome = {
  ...devices["Pixel 7"],
  ...(chromeChannel ? { channel: chromeChannel } : {}),
};

function getWebServerCommand() {
  if (isCI) return `npm run start -- --port ${e2ePort}`;
  if (useDevServer) return `npm run dev -- --port ${e2ePort}`;
  return `npm run build && npm run start -- --port ${e2ePort}`;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  // QA-M3: Retries keep the gate green on transient CI flakes but obscure
  // which tests needed >1 attempt. The "list" reporter surfaces flaky counts
  // (tests that passed on retry) alongside the HTML report so they remain
  // visible and actionable — a retry-only pass is NOT a clean pass.
  // Monitor: if flaky count grows, investigate root cause rather than raising retries.
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["html"], ["github"], ["list"]] : [["html"]],
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
      use: desktopChrome,
      testIgnore: [
        "**/qa-journey.spec.ts",
        "**/visual-regression.spec.ts",
        "**/stripe-real-checkout.spec.ts",
      ],
    },
    {
      name: "mobile",
      use: mobileChrome,
      testIgnore: [
        "**/qa-journey.spec.ts",
        "**/visual-regression.spec.ts",
        "**/stripe-real-checkout.spec.ts",
      ],
    },
    {
      name: "qa-journey",
      use: desktopChrome,
      testMatch: "qa-journey.spec.ts",
      timeout: 30_000,
    },
    {
      name: "stripe-integration",
      use: { ...desktopChrome, locale: "en-US" },
      testMatch: "stripe-real-checkout.spec.ts",
      timeout: 120_000,
    },
    {
      name: "visual-desktop",
      use: { ...desktopChrome, locale: "en-US" },
      testMatch: "visual-regression.spec.ts",
    },
    {
      name: "visual-mobile",
      use: { ...mobileChrome, locale: "en-US" },
      testMatch: "visual-regression.spec.ts",
    },
  ],

  webServer: {
    command: getWebServerCommand(),
    url: `${baseURL}/api/health/live`,
    // Default local runs to an isolated production-style server because next dev's
    // issues overlay can intercept mobile clicks and hide real regressions.
    reuseExistingServer,
    timeout: 180_000,
    // Wait for the liveness endpoint, not just an open TCP port.
    ...(isCI && { stdout: "pipe" }),
    env: {
      ANTHROPIC_API_KEY: "dummy_key_for_e2e",
      VOYAGE_API_KEY: "dummy_key_for_e2e",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy_key_for_e2e",
      MAINTENANCE_MODE: "false",
      STRIPE_SECRET_KEY: "sk_test_dummy_for_e2e",
      STRIPE_DAY_PASS_PRICE_ID: "price_test_dummy_for_e2e",
      PLAYWRIGHT_TEST_ORIGIN: baseURL,
    },
  },
});
