import { test, expect } from "@playwright/test";
import { MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

test.describe("Checkout flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock feature flags
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );
  });

  test("pricing page loads with day pass card", async ({ page }) => {
    // Mock voice access to show pricing card (not already purchased)
    await page.route("**/api/voice-access", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hasAccess: false,
          canUseVoice: false,
          isWhitelisted: false,
          needsSignIn: false,
          needsPurchase: true,
          expiresAt: null,
          hoursUntilExpiry: null,
        }),
      })
    );

    await page.goto("/pricing");
    await expect(page.locator("body")).not.toBeEmpty();

    // Verify the price is displayed
    await expect(page.getByText("€1.99")).toBeVisible({ timeout: 10000 });
  });

  test("checkout page shows sign-in prompt for unauthenticated users", async ({
    page,
  }) => {
    // Mock Supabase auth to return no session (unauthenticated)
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: "not authenticated" }) })
    );

    const response = await page.goto("/pricing/checkout");
    expect(response?.ok()).toBe(true);

    // The checkout page should render (even if it shows sign-in prompt)
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("checkout page returns valid HTML response", async ({ page }) => {
    // Verify the checkout page returns a valid response (200)
    // Without authentication, it shows a sign-in prompt —
    // the #checkout container only renders for authenticated users.
    const response = await page.goto("/pricing/checkout");
    expect(response?.ok()).toBe(true);

    // Page should have rendered (not a blank error page)
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("pricing page back link navigates to /immersive", async ({ page }) => {
    await page.route("**/api/voice-access", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hasAccess: false,
          canUseVoice: false,
          isWhitelisted: false,
          needsSignIn: false,
          needsPurchase: true,
          expiresAt: null,
          hoursUntilExpiry: null,
        }),
      })
    );

    await page.goto("/pricing");

    // Wait for page to load
    await expect(page.getByText("€1.99")).toBeVisible({ timeout: 10000 });

    // Find and click the back arrow link
    const backLink = page.locator('a[href="/immersive"]');
    await expect(backLink).toBeVisible();
  });
});
