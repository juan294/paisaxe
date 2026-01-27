import { test, expect } from "@playwright/test";

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

  test("health endpoint responds with JSON", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("timestamp");
    expect(["healthy", "degraded"]).toContain(body.status);
  });
});
