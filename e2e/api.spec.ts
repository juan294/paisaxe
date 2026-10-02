import { test, expect } from "./fixtures/base-test";
import type { APIRequestContext, APIResponse } from "@playwright/test";

/**
 * Helper to get CSRF headers by visiting a page first.
 * The proxy sets a __csrf cookie on non-API page requests.
 * Returns headers with both the cookie and the x-csrf-token header.
 */
async function getCsrfHeaders(request: APIRequestContext) {
  const pageResponse = await request.get("/immersive");
  const setCookie = pageResponse.headers()["set-cookie"] || "";
  const match = setCookie.match(/__csrf=([a-f0-9]+)/);
  const token = match?.[1] || "";
  const origin = new URL(pageResponse.url()).origin;
  return {
    "x-csrf-token": token,
    Cookie: `__csrf=${token}`,
    Origin: origin,
  };
}

/** Shared assertion for validateAdminAuth()'s standard rejection shape. */
async function expectAuthRequired(response: APIResponse) {
  expect(response.status()).toBe(401);

  const body = await response.json();
  expect(body.error).toBe("Authentication required");
}

test.describe("API route smoke tests", () => {
  test("GET /api/health/live returns liveness JSON", async ({ request }) => {
    const response = await request.get("/api/health/live");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("live");
    expect(body.timestamp).toBeTruthy();
  });

  test("GET /api/health returns diagnostics JSON", async ({ request }) => {
    test.slow();

    const response = await request.get("/api/health", { timeout: 45_000 });
    // This dummy-key E2E suite validates the diagnostics contract. Launch
    // readiness is enforced by scripts/check-health-readiness.mjs in CI.
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.timestamp).toBeTruthy();
    expect(["healthy", "degraded"]).toContain(body.status);
  });

  test("GET /api/stories returns a non-empty story list", async ({
    request,
  }) => {
    const response = await request.get("/api/stories");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("GET /api/feature-flags returns data or error", async ({ request }) => {
    const response = await request.get("/api/feature-flags");
    const body = await response.json();

    // With dummy Supabase credentials, this may return 500 or succeed with cached data
    // Either way, it should return valid JSON
    expect(body).toBeDefined();
    if (response.ok()) {
      expect(body).toHaveProperty("data");
    } else {
      expect(body).toHaveProperty("error");
    }
  });

  // BE-H6/AR-H1 (#781, #855): /api/chat (non-streaming) was deleted — it had
  // no caller besides this test. /api/chat/stream is the only route any real
  // client calls, so the smoke coverage moves there. Validation failures
  // short-circuit before the response becomes an SSE stream, so this
  // specific case is still JSON; the second test below asserts the SSE
  // framing (Content-Type: text/event-stream) that a real request produces.
  test("POST /api/chat/stream rejects empty body", async ({ request }) => {
    const csrf = await getCsrfHeaders(request);
    const response = await request.post("/api/chat/stream", {
      headers: csrf,
      data: {},
    });
    // Should return 400 for invalid/empty request
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("POST /api/chat/stream returns SSE-framed response for a valid request", async ({
    request,
  }) => {
    const csrf = await getCsrfHeaders(request);
    const response = await request.post("/api/chat/stream", {
      headers: csrf,
      data: { message: "Hola" },
    });

    // A valid, non-flagged request streams via SSE rather than plain JSON.
    // (Dummy AI credentials in this E2E environment still yield a stream
    // response — it terminates with an "error" SSE event rather than a
    // successful "done" event, but the framing under test is the same.)
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/event-stream");

    const body = await response.text();
    expect(body).toContain("data: ");
  });

  test("GET /api/favorites returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/favorites");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("POST /api/favorites returns 401 without auth", async ({ request }) => {
    const csrf = await getCsrfHeaders(request);
    const response = await request.post("/api/favorites", {
      headers: csrf,
      data: { storyIds: ["test-id"] },
    });
    expect(response.status()).toBe(401);
  });

  test("DELETE /api/favorites returns 401 without auth", async ({
    request,
  }) => {
    const csrf = await getCsrfHeaders(request);
    const response = await request.delete("/api/favorites?storyId=test-id", {
      headers: csrf,
    });
    expect(response.status()).toBe(401);
  });

  // QA-M4 (2026-09-24): broaden smoke coverage to the admin/cron/health routes
  // that had none. For every route below, the source was read to confirm
  // validateAdminAuth() / verifyVercelCron() / verifyWebhookSecret() runs
  // BEFORE any query-param, `[id]`/`[key]`, or body parsing — so a garbage
  // placeholder id and an empty/missing body are safe: an unauthenticated
  // request cannot reach that later parsing regardless of what it contains.

  // GET routes guarded by validateAdminAuth()/withAdmin()/withAdminRead() with
  // no CSRF concern (GET is not a CSRF-checked method — see
  // src/lib/proxy/csrf-proxy.ts CSRF_METHODS).
  const ADMIN_GET_ROUTES = [
    "/api/admin/agent-reports",
    "/api/admin/agents-summary",
    "/api/admin/agents/run",
    "/api/admin/analytics",
    "/api/admin/costs-analytics",
    "/api/admin/costs-analytics/test-id",
    "/api/admin/elevenlabs-analytics",
    "/api/admin/github-analytics",
    "/api/admin/marketing/accounts",
    "/api/admin/marketing/agent",
    "/api/admin/marketing/agent-logs",
    "/api/admin/marketing/dashboard",
    "/api/admin/marketing/posts",
    "/api/admin/marketing/schedule",
    "/api/admin/stories",
    "/api/admin/stories/test-id/content-images",
    "/api/admin/stories/test-id/translations",
    "/api/admin/stripe-analytics",
    "/api/admin/suggestions",
  ];

  for (const path of ADMIN_GET_ROUTES) {
    test(`GET ${path} returns 401 without auth`, async ({ request }) => {
      const response = await request.get(path);
      await expectAuthRequired(response);
    });
  }

  // State-changing admin routes. Unlike /api/cron/* and /api/health*,
  // /api/admin/* is NOT in the proxy's CSRF-exempt prefix list (src/lib/csrf.ts
  // CSRF_EXEMPT_PREFIXES), so a POST/PUT/PATCH/DELETE without a valid
  // Origin + CSRF token is rejected by the proxy (403 "Origin not allowed")
  // before the route's own validateAdminAuth() ever runs. The CSRF headers
  // here get past that proxy gate so the assertion below exercises the
  // route's actual auth check, same as the existing POST/DELETE
  // /api/favorites tests above.
  const ADMIN_WRITE_ROUTES: Array<{
    method: "post" | "put" | "patch" | "delete";
    path: string;
  }> = [
    { method: "put", path: "/api/admin/feature-flags/test-key" },
    { method: "patch", path: "/api/admin/stories/test-id" },
    { method: "put", path: "/api/admin/stories/test-id/image" },
    { method: "put", path: "/api/admin/stories/test-id/image-source" },
    { method: "put", path: "/api/admin/stories/test-id/status" },
    { method: "post", path: "/api/admin/stories/approve-all" },
    { method: "delete", path: "/api/admin/stories/bulk-delete" },
    { method: "put", path: "/api/admin/stories/bulk-status" },
    { method: "delete", path: "/api/admin/suggestions/test-id" },
    { method: "post", path: "/api/admin/voice-session" },
  ];

  for (const { method, path } of ADMIN_WRITE_ROUTES) {
    test(`${method.toUpperCase()} ${path} returns 401 without auth`, async ({
      request,
    }) => {
      const csrf = await getCsrfHeaders(request);
      const response = await request[method](path, {
        headers: csrf,
        data: {},
      });
      await expectAuthRequired(response);
    });
  }

  // Cron routes: /api/cron/* is CSRF-exempt (Vercel Cron and pg_cron callers
  // can't present a browser-issued CSRF token), so GET reaches the route's
  // own verifyVercelCron() check directly.
  const CRON_GET_ROUTES = [
    "/api/cron/content-discovery",
    "/api/cron/elevenlabs-voice-canary",
    "/api/cron/fail-stale-bookings",
    "/api/cron/fail-stale-translations",
    "/api/cron/github-traffic-sync",
    "/api/cron/subscription-optimizer",
    "/api/cron/retry-booking-sms",
  ];

  for (const path of CRON_GET_ROUTES) {
    test(`GET ${path} rejects unauthenticated calls`, async ({ request }) => {
      const response = await request.get(path);
      expect([401, 403]).toContain(response.status());

      const body = await response.json();
      expect(body).toHaveProperty("error");
    });
  }

  // /api/health/voice is a deep health probe gated by a HEALTH_PROBE_SECRET
  // bearer header (src/app/api/health/voice/route.ts isAuthorized()) rather
  // than admin auth or cron auth — confirmed it does require auth, unlike
  // the public /api/health and /api/health/live probes above.
  test("GET /api/health/voice returns 401 without the health-probe secret", async ({
    request,
  }) => {
    const response = await request.get("/api/health/voice");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  // Excluded from the loops above (QA-M4): both routes gate on the runtime
  // environment BEFORE calling validateAdminAuth(), so an unauthenticated
  // request never reaches the auth check at all — it always gets the same
  // dev/prod-only 403 regardless of auth state, which would not actually
  // verify authentication is enforced:
  // - GET/PUT /api/admin/agent-config: 403 "Agent config is only available in
  //   development" whenever NODE_ENV !== "development" (this E2E suite runs a
  //   production build via `next build && next start`).
  // - GET/POST/DELETE /api/admin/tunnel: 403 "Tunnel control is only available
  //   in development" whenever NODE_ENV === "production".
});
