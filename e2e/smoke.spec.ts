import { test, expect } from "./fixtures/base-test";

test.describe("Smoke tests", () => {
  test("/ redirects to /immersive", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/immersive");
    expect(page.url()).toContain("/immersive");
  });

  test("/immersive loads successfully", async ({ page }) => {
    const response = await page.goto("/immersive");
    expect(response?.ok()).toBe(true);
    // The page should have content (not blank)
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("non-existent page returns 404", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("client-side JavaScript executes (CSP canary)", async ({ page }) => {
    // Canary test: if CSP blocks scripts (e.g., nonce mismatch from PPR),
    // pages never hydrate and stay on the loading spinner forever.
    // This test catches that by verifying a client-rendered page resolves.
    await page.goto("/favorites");
    // The favorites page shows a loading spinner while JS loads, then renders
    // interactive content. If JS is blocked, it stays on the spinner.
    // Check for the "Explore stories" link which only appears after hydration.
    await expect(
      page.getByRole("link", { name: /explore stories|explorar historias/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("health endpoint responds with JSON", async ({ request }) => {
    const response = await request.get("/api/health");
    // Health endpoint returns 200 (healthy) or 503 (degraded) — both are valid
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("timestamp");
    expect(["healthy", "degraded"]).toContain(body.status);
  });

  test("health/db probe is reachable and well-formed", async ({
    request,
  }) => {
    // The e2e webServer runs against a dummy Supabase URL (playwright.config.ts),
    // so this asserts the probe's response contract, not live DB connectivity —
    // catching probe regressions (wrong status, malformed JSON, leaked error
    // detail) independent of whichever backend it's pointed at.
    const response = await request.get("/api/health/db");
    expect([200, 500]).toContain(response.status());

    const body = await response.json();
    expect(typeof body.success).toBe("boolean");
    if (body.success) {
      expect(body.tablesAccessible).toBe(true);
      expect(typeof body.latencyMs).toBe("number");
    } else {
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    }
  });
});
