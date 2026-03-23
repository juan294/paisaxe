import { test, expect } from "./fixtures/base-test";
import {
  MOCK_FEATURE_FLAGS,
  MOCK_SUGGESTION_RESPONSE,
  withFeatureFlags,
} from "./fixtures/mock-data";

/**
 * Suggestion Feature E2E Tests
 *
 * Tests the anonymous story suggestion flow: button visibility,
 * dialog interaction, form validation, API error handling.
 *
 * The suggest button uses `hidden md:block` — these tests run on desktop only.
 *
 * Run with: npx playwright test suggestions.spec.ts --project=desktop
 */

test.describe("Suggestion feature", () => {
  // Suggest button uses hidden md:block — skip on mobile viewports
  test.beforeEach(async ({ page }, testInfo) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      testInfo.skip(true, "Suggest button uses hidden md:block — not visible on mobile");
    }
  });

  test("button visible when user_story_suggestions flag is enabled", async ({
    page,
  }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          withFeatureFlags({ user_story_suggestions: true })
        ),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();

    await expect(
      page.locator("[data-suggest-place-trigger]")
    ).toBeVisible();
  });

  test("button hidden when user_story_suggestions flag is disabled", async ({
    page,
  }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();

    await expect(
      page.locator("[data-suggest-place-trigger]")
    ).toHaveCount(0);
  });

  test.describe("with flag enabled", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("**/api/feature-flags", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            withFeatureFlags({ user_story_suggestions: true })
          ),
        })
      );

      await page.goto("/immersive");
      await expect(page.locator("h1").first()).toBeVisible();
    });

    test("opens dialog on click", async ({ page }) => {
      await page.locator("[data-suggest-place-trigger]").click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Dialog should have title and form fields
      await expect(dialog.locator("#place-name")).toBeVisible();
    });

    test("submits with valid data and shows success", async ({ page }) => {
      // Mock the suggestions API to return success
      await page.route("**/api/suggestions", (route) =>
        route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SUGGESTION_RESPONSE),
        })
      );

      await page.locator("[data-suggest-place-trigger]").click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Fill in the place name
      await dialog.locator("#place-name").fill("Playa del Silencio");

      // Submit and wait for the mocked API response to complete
      const submitButton = dialog.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();

      await Promise.all([
        page.waitForResponse((resp) =>
          resp.url().includes("/api/suggestions") && resp.status() === 201
        ),
        submitButton.click(),
      ]);

      // Should show success state — the success view has success title text
      await expect(
        dialog.getByText(/thank|gracias|success/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test("prevents submit when name too short", async ({ page }) => {
      await page.locator("[data-suggest-place-trigger]").click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Fill with only 2 characters
      await dialog.locator("#place-name").fill("Ab");

      // Submit button should be disabled
      const submitButton = dialog.locator('button[type="submit"]');
      await expect(submitButton).toBeDisabled();
    });

    test("shows error on API 500", async ({ page }) => {
      await page.route("**/api/suggestions", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Failed to create suggestion" }),
        })
      );

      await page.locator("[data-suggest-place-trigger]").click();

      const dialog = page.getByRole("dialog");
      await dialog.locator("#place-name").fill("Playa del Silencio");

      await dialog.locator('button[type="submit"]').click();

      // Should show error message text
      await expect(
        dialog.getByText(/failed to create suggestion/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test("shows rate limit error on 429", async ({ page }) => {
      await page.route("**/api/suggestions", (route) =>
        route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Rate limit exceeded. Please wait before submitting another suggestion.",
          }),
        })
      );

      await page.locator("[data-suggest-place-trigger]").click();

      const dialog = page.getByRole("dialog");
      await dialog.locator("#place-name").fill("Playa del Silencio");

      await dialog.locator('button[type="submit"]').click();

      // Should show rate limit error text (from translation key)
      await expect(
        dialog.getByText(/rate limit|wait|límite/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test("closes dialog via cancel button", async ({ page }) => {
      await page.locator("[data-suggest-place-trigger]").click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Click cancel button
      const cancelButton = dialog
        .locator("button[type='button']")
        .filter({ hasText: /cancel|cancelar/i });
      await cancelButton.click();

      await expect(dialog).not.toBeVisible();
    });
  });
});
