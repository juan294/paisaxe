import { test, expect } from "./fixtures/base-test";
import { MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

test.describe("Immersive story viewer", () => {
  test.beforeEach(async ({ page }) => {
    // Mock feature flags to disable overlays that could interfere
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );
    await page.goto("/immersive");
  });

  test("renders a story with title and description", async ({ page }) => {
    // Fallback stories should load — first story is "Lagos de Covadonga"
    const title = page.getByTestId("story-title").first();
    await expect(title).toBeVisible({ timeout: 15000 });
    await expect(title).not.toBeEmpty();
  });

  test("shows navigation arrows", async ({ page }) => {
    // Wait for the story to render
    await expect(page.getByTestId("story-title").first()).toBeVisible({ timeout: 15000 });

    // Navigation arrows — both enabled since carousel loops infinitely
    // Use .first() to avoid strict mode violations during i18n hydration overlap
    const prevButton = page.getByTestId("prev-story-button").first();
    const nextButton = page.getByTestId("next-story-button").first();

    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
  });

  test("navigates to next story via arrow click", async ({ page }) => {
    const title = page.getByTestId("story-title").first();
    await expect(title).toBeVisible({ timeout: 15000 });
    const firstTitle = await title.textContent();

    // Click next arrow
    const nextButton = page.getByTestId("next-story-button").first();
    await nextButton.click();

    // Wait for transition and verify title changed
    await page.waitForTimeout(400);
    const secondTitle = await title.textContent();
    expect(secondTitle).not.toBe(firstTitle);
  });

  test("navigates via keyboard arrow keys", async ({ page }) => {
    const title = page.getByTestId("story-title").first();
    await expect(title).toBeVisible({ timeout: 15000 });
    const firstTitle = await title.textContent();

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);

    const secondTitle = await title.textContent();
    expect(secondTitle).not.toBe(firstTitle);
  });

  test("toggles info overlay with 'i' key", async ({
    page,
    isMobile,
  }) => {
    // On mobile emulation, keyboard events may not reliably trigger
    // the window keydown handler that toggles info overlay
    test.skip(isMobile, "Keyboard shortcut 'i' toggle is desktop-only");

    const title = page.getByTestId("story-title").first();
    await expect(title).toBeVisible({ timeout: 15000 });

    // Info is visible by default - check the info panel is at full opacity
    // Use .first() because the carousel may render multiple story panels simultaneously
    const infoPanel = page.getByTestId("story-info-panel").first();
    await expect(infoPanel).toHaveCSS("opacity", "1");

    // Press 'i' to hide info overlay
    await page.keyboard.press("i");

    // After toggle, the info panel should transition to opacity 0
    await expect(infoPanel).toHaveCSS("opacity", "0", { timeout: 5000 });
  });
});
