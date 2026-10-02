import { defineConfig, devices } from "@playwright/test";
import { E2E_MCP_SECRET } from "./e2e/fixtures/mcp-secret";

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

/**
 * Release verification (Wave A, Phase 3).
 *
 * RELEASE_TARGET_URL points the `release-required` project at an already
 * deployed origin. When it is set, no local web server is started — the probes
 * exercise the deployment itself, read-only (plan D-B: Preview shares the
 * production Supabase project and holds live Stripe keys, so a deployed probe
 * must never mutate).
 *
 * Mutating required probes carry `@local-docker` as well as `@release-required`
 * and are selected by a separate project that only ever runs against localhost.
 * The `grepInvert` below is the mechanism that makes that separation
 * unbypassable: a deployed run cannot select a mutating probe.
 */
const releaseTargetUrl = process.env.RELEASE_TARGET_URL?.trim();
const releaseBypassSecret =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const releaseSpecs = ["**/release-required.spec.ts", "**/release-required-local.spec.ts"];

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

  // QA-M1: No config-level `storageState` seed here. The old file-based seed
  // (e2e/storage-state.json) wrote a localStorage key, but NavigationHint
  // reads/writes sessionStorage (see src/components/immersive/navigation-hint.tsx),
  // which Playwright's storageState mechanism cannot restore at all — the seed
  // had been inert since that change, and was also hardcoded to localhost:3100
  // (mismatching the port-3101 stripe-e2e server). Suppression now happens via
  // an origin-agnostic `addInitScript` in e2e/fixtures/base-test.ts.
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: isCI ? "off" : "retain-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: desktopChrome,
      testIgnore: [
        "**/qa-journey.spec.ts",
        "**/visual-regression.spec.ts",
        "**/stripe-real-checkout.spec.ts",
        "**/favorites-real.spec.ts",
        ...releaseSpecs,
      ],
    },
    {
      name: "mobile",
      use: mobileChrome,
      testIgnore: [
        "**/qa-journey.spec.ts",
        "**/visual-regression.spec.ts",
        "**/stripe-real-checkout.spec.ts",
        "**/favorites-real.spec.ts",
        ...releaseSpecs,
      ],
    },
    {
      name: "qa-journey",
      use: desktopChrome,
      testMatch: "qa-journey.spec.ts",
      timeout: 30_000,
      // Local runs auto-detect worker count (undefined) and can hit 6+
      // workers against one shared dev server, causing teardown timeouts
      // that look like failures but are resource contention (QA 2026-09-24).
      // CI already caps workers at 2 (see `isCI` above) so only local runs
      // need the cap here.
      workers: isCI ? undefined : 3,
    },
    {
      name: "stripe-integration",
      use: { ...desktopChrome, locale: "en-US" },
      testMatch: "stripe-real-checkout.spec.ts",
      timeout: 120_000,
      // This is a release gate: a Playwright retry would turn a flaky payment
      // into a green check that does not satisfy the pre-launch contract.
      retries: 0,
    },
    {
      // FE-B2: the only project that exercises a client-side authenticated
      // journey through the real UI (bookmark toggle) rather than an API
      // bypass. Meaningless with the shared webServer's default dummy
      // credentials — see e2e/favorites-real.spec.ts for the required
      // invocation. Never selected by `npm run test:e2e`; local Docker /
      // release-candidate verification only, matching FE-B2's regression
      // guidance not to add stateful checks to routine CI.
      name: "auth-integration",
      use: { ...desktopChrome, locale: "en-US" },
      testMatch: "favorites-real.spec.ts",
      // Does two full navigations (initial load + reload) plus two
      // API round trips against the sign-in fixture's cold-started server —
      // matches release-required-local's budget, not the default 30s.
      timeout: 60_000,
      retries: 0,
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
    {
      // Deployed, read-only required probes. Anonymous by design: the
      // admin-denial probe is only meaningful without a stored session.
      name: "release-required",
      use: {
        ...desktopChrome,
        baseURL: releaseTargetUrl || baseURL,
        storageState: undefined,
        ...(releaseBypassSecret
          ? {
              extraHTTPHeaders: {
                "x-vercel-protection-bypass": releaseBypassSecret,
              },
            }
          : {}),
      },
      grep: /@release-required/,
      grepInvert: /@local-docker/,
      timeout: 60_000,
      retries: 0,
    },
    {
      // Mutating required probes. Localhost only — never a deployed origin.
      name: "release-required-local",
      use: desktopChrome,
      grep: /@local-docker/,
      timeout: 60_000,
      retries: 0,
    },
  ],

  // Targeting a deployment means there is nothing to boot locally.
  webServer: releaseTargetUrl ? undefined : {
    command: getWebServerCommand(),
    url: `${baseURL}/api/health/live`,
    // Default local runs to an isolated production-style server because next dev's
    // issues overlay can intercept mobile clicks and hide real regressions.
    reuseExistingServer,
    // Bumped from 180s: the P1 Supabase deferral (async getClient() in
    // stories-data.ts/realtime.ts) adds an on-demand webpack chunk compile
    // to the first dev-server request that touches Supabase, widening
    // cold-start time. Not a production concern (chunks are pre-built).
    timeout: 240_000,
    // Wait for the liveness endpoint, not just an open TCP port.
    ...(isCI && { stdout: "pipe" }),
    env: {
      ANTHROPIC_API_KEY: "dummy_key_for_e2e",
      VOYAGE_API_KEY: "dummy_key_for_e2e",
      // Release-required-local explicitly supplies the local Docker values.
      // Other local suites keep deterministic dummy defaults.
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy_key_for_e2e",
      MAINTENANCE_MODE: "false",
      STRIPE_SECRET_KEY: "sk_test_dummy_for_e2e",
      STRIPE_DAY_PASS_PRICE_ID: "price_test_dummy_for_e2e",
      PLAYWRIGHT_TEST_ORIGIN: baseURL,
      // Shared with the runner so the MCP probes exercise the authenticated
      // paths instead of skipping — see e2e/fixtures/mcp-secret.ts.
      MCP_API_SECRET: E2E_MCP_SECRET,
    },
  },
});
