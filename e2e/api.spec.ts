import { test, expect } from "./fixtures/base-test";
import type { APIRequestContext } from "@playwright/test";

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

  test("GET /api/admin/* returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/admin/agent-reports");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Authentication required");
  });

  test("GET /api/cron/* rejects unauthenticated calls", async ({ request }) => {
    const response = await request.get("/api/cron/retry-booking-sms");
    expect([401, 403]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty("error");
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
});
