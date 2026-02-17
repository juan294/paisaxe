import { test, expect } from "@playwright/test";
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
    const prevButton = page.getByTestId("prev-story-button");
    const nextButton = page.getByTestId("next-story-button");

    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
  });

  test("navigates to next story via arrow click", async ({ page }) => {
    const title = page.getByTestId("story-title").first();
    await expect(title).toBeVisible({ timeout: 15000 });
    const firstTitle = await title.textContent();

    // Click next arrow
    const nextButton = page.getByTestId("next-story-button");
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

  test("toggles info overlay with 'i' key", async ({ page }) => {
    const title = page.getByTestId("story-title").first();
    await expect(title).toBeVisible({ timeout: 15000 });

    // Info is visible by default - check the info panel is at full opacity
    const infoPanel = page.getByTestId("story-info-panel");
    await expect(infoPanel).toHaveCSS("opacity", "1");

    // Press 'i' to hide info overlay
    await page.keyboard.press("i");

    // The info container transitions to opacity-0 / translate-y
    // Wait for the CSS transition (duration-500 = 500ms)
    await page.waitForTimeout(600);

    // After toggle, the info panel should have opacity 0
    await expect(infoPanel).toHaveCSS("opacity", "0", { timeout: 5000 });
  });
});
