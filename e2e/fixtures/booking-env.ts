/**
 * Constants of the local booking probes, kept free of heavy imports because
 * playwright.config.ts loads this file on every run. See booking-local.ts.
 */

/** The PayPal stand-in (src/test/paypal-mock-server.ts) started by e2e/booking-global-setup.ts. */
export const BOOKING_PAYPAL_MOCK_PORT = 4020;
/** Its control route (POST /paypal/orders/:id/approve), standing in for the sandbox buyer. */
export const BOOKING_PAYPAL_CONTROL_PORT = 4021;
/** A second local server with VERCEL_ENV=preview, for the Preview-isolation assertions. */
export const BOOKING_PREVIEW_PORT = 3102;
export const BOOKING_PREVIEW_ORIGIN = `http://localhost:${BOOKING_PREVIEW_PORT}`;
/** The PayPal stand-in's credentials (it rejects any others). */
export const E2E_PAYPAL_CREDENTIAL = "local-mock";
/** Public, local-only test value; production has its own secret. */
export const E2E_BOOKING_LINK_SECRET = "e2e-local-booking-link-secret-not-for-any-deployment-0000000000";
/** e2e/fixtures/booking-agent-replay/<name>.json, loaded by src/lib/booking/replay-model.ts. */
export const E2E_BOOKING_REPLAY = "e2e";
/** An origin every deployment's CSRF allowlist accepts (src/lib/proxy/cors.ts). */
export const CANONICAL_ORIGIN = "https://paisaxe.es";

export const FIXTURE_MERCHANT = "demo-rutas-del-sella";

function selectsProject(argv: string[], project: string): boolean {
  return argv.some((arg, i) => arg === `--project=${project}` || (arg === "--project" && argv[i + 1] === project));
}

/** True when this Playwright run is the release-artifact smoke (preview-smoke.yml), which serves only the CI-built candidate. */
export function isReleaseArtifactRun(argv: string[] = process.argv): boolean {
  return selectsProject(argv, "release-artifact-smoke");
}

/** True when this Playwright run selects the release-required-local project, outside the release-artifact smoke. */
export function isReleaseLocalRun(argv: string[] = process.argv): boolean {
  return selectsProject(argv, "release-required-local") && !isReleaseArtifactRun(argv);
}

/** The server-side environment the local booking probes need on top of the shared webServer env. */
export function localBookingServerEnv(origin: string): Record<string, string> {
  return {
    BOOKING_AGENT_REPLAY: E2E_BOOKING_REPLAY,
    BOOKING_LINK_SECRET: E2E_BOOKING_LINK_SECRET,
    PAYPAL_CLIENT_ID: E2E_PAYPAL_CREDENTIAL,
    PAYPAL_CLIENT_SECRET: E2E_PAYPAL_CREDENTIAL,
    PAYPAL_WEBHOOK_ID: E2E_PAYPAL_CREDENTIAL,
    PAYPAL_API_BASE: `http://127.0.0.1:${BOOKING_PAYPAL_MOCK_PORT}`,
    // Local site URL: development flags, the in-memory rate limiter, and
    // PayPal return URLs on this origin (src/lib/environment.ts, capture.ts).
    NEXT_PUBLIC_SITE_URL: origin,
  };
}
