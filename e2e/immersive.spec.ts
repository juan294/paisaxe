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
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).not.toBeEmpty();
  });

  test("shows navigation arrows", async ({ page }) => {
    // Wait for the story to render
    await expect(page.locator("h1")).toBeVisible();

    // Navigation arrows — left is disabled on first story
    const prevButton = page.locator("button").filter({ has: page.locator("svg.lucide-chevron-left") });
    const nextButton = page.locator("button").filter({ has: page.locator("svg.lucide-chevron-right") });

    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
    await expect(prevButton).toBeDisabled();
  });

  test("navigates to next story via arrow click", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    const firstTitle = await page.locator("h1").textContent();

    // Click next arrow
    const nextButton = page.locator("button").filter({ has: page.locator("svg.lucide-chevron-right") });
    await nextButton.click();

    // Wait for transition and verify title changed
    await page.waitForTimeout(400);
    const secondTitle = await page.locator("h1").textContent();
    expect(secondTitle).not.toBe(firstTitle);
  });

  test("navigates via keyboard arrow keys", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    const firstTitle = await page.locator("h1").textContent();

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);

    const secondTitle = await page.locator("h1").textContent();
    expect(secondTitle).not.toBe(firstTitle);
  });

  test("toggles info overlay with 'i' key", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();

    // Info is visible by default - check h1 is visible
    await expect(page.locator("h1")).toHaveCSS("opacity", "1");

    // Press 'i' to hide info overlay
    await page.keyboard.press("i");

    // The info container transitions to opacity-0 / translate-y
    // Wait for the CSS transition (duration-500 = 500ms)
    await page.waitForTimeout(600);

    // After toggle, the h1 should still exist in DOM but be inside a hidden container
    // The bottom panel has class "opacity-0 translate-y-8" when hidden
    // Verify by checking the bottom panel's computed opacity
    const bottomPanel = page.locator(".absolute.bottom-0.left-0.right-0");
    await expect(bottomPanel).toHaveCSS("opacity", "0");
  });
});
