import { test, expect } from "@playwright/test";

test.describe("API route smoke tests", () => {
  test("GET /api/health returns valid JSON", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.version).toBe("0.1.0");
    expect(body.timestamp).toBeTruthy();
    expect(body.services).toHaveProperty("supabase");
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
    const response = await request.post("/api/chat", {
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
    const response = await request.post("/api/favorites", {
      data: { storyIds: ["test-id"] },
    });
    expect(response.status()).toBe(401);
  });

  test("DELETE /api/favorites returns 401 without auth", async ({ request }) => {
    const response = await request.delete("/api/favorites?storyId=test-id");
    expect(response.status()).toBe(401);
  });
});
