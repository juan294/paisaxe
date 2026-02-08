import { test, expect } from "@playwright/test";
import { MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

test.describe("Author pill", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );
    await page.goto("/immersive");
    // Wait for the story to render
    await expect(page.locator("h1")).toBeVisible();
  });

  test("renders the pill with initial text on desktop", async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    const pill = page.locator('[aria-label="Made by Juan González"]');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("</> JG");
  });

  test("pill is hidden on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const pill = page.locator('[aria-label="Made by Juan González"]');
    await expect(pill).toBeHidden();
  });

  test("shows popover with social links on hover", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const pillGroup = page.locator('[aria-label="Made by Juan González"]').locator("..");

    // Hover over the pill group
    await pillGroup.hover();

    // Social links should become visible
    const xLink = page.locator('a[aria-label="X (Twitter)"]');
    const linkedinLink = page.locator('a[aria-label="LinkedIn"]');
    const mediumLink = page.locator('a[aria-label="Medium"]');

    await expect(xLink).toBeVisible();
    await expect(linkedinLink).toBeVisible();
    await expect(mediumLink).toBeVisible();
  });

  test("social links have correct hrefs", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const xLink = page.locator('a[aria-label="X (Twitter)"]');
    const linkedinLink = page.locator('a[aria-label="LinkedIn"]');
    const mediumLink = page.locator('a[aria-label="Medium"]');

    await expect(xLink).toHaveAttribute("href", "https://x.com/JuanG294");
    await expect(linkedinLink).toHaveAttribute("href", "https://www.linkedin.com/in/juanagonzalezp/");
    await expect(mediumLink).toHaveAttribute("href", "https://medium.com/@juang294");
  });

  test("social links open in new tab", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const xLink = page.locator('a[aria-label="X (Twitter)"]');
    await expect(xLink).toHaveAttribute("target", "_blank");
    await expect(xLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("clicking pill does not toggle story info", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Verify info is visible initially
    const bottomPanel = page.locator("article.absolute.bottom-0");
    await expect(bottomPanel).toHaveCSS("opacity", "1");

    // Click the pill
    const pill = page.locator('[aria-label="Made by Juan González"]');
    await pill.click();

    // Wait for any potential transition
    await page.waitForTimeout(600);

    // Info should still be visible
    await expect(bottomPanel).toHaveCSS("opacity", "1");
  });

  test("pill has blinking cursor", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const pill = page.locator('[aria-label="Made by Juan González"]');
    // The cursor span inside the pill should have the animation class
    const cursor = pill.locator(".animate-cursor-blink");
    await expect(cursor).toBeVisible();
  });

  test("displays author name in popover", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const pillGroup = page.locator('[aria-label="Made by Juan González"]').locator("..");
    await pillGroup.hover();

    await expect(page.locator("text=Juan González")).toBeVisible();
  });
});
