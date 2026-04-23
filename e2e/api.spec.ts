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
  return {
    "x-csrf-token": token,
    Cookie: `__csrf=${token}`,
  };
}

test.describe("API route smoke tests", () => {
  test("GET /api/health returns valid JSON", async ({ request }) => {
    test.slow();

    const response = await request.get("/api/health", { timeout: 45_000 });
    // Health endpoint returns 200 (healthy) or 503 (degraded) — both are valid
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body.version).toBeTruthy();
    expect(body.timestamp).toBeTruthy();
    expect(body.services).toHaveProperty("supabase");
    expect(["healthy", "degraded"]).toContain(body.status);
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

  test("POST /api/chat rejects empty body", async ({ request }) => {
    const csrf = await getCsrfHeaders(request);
    const response = await request.post("/api/chat", {
      headers: csrf,
      data: {},
    });
    // Should return 400 for invalid/empty request
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty("error");
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
});
