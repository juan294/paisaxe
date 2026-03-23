import { test, expect } from "./fixtures/base-test";

test.describe("Favorites page", () => {
  test("shows empty state when no favorites saved", async ({ page }) => {
    await page.goto("/favorites");

    // Empty state shows a prominent explore link (not the small back arrow in header)
    const exploreLink = page.getByRole("link", { name: /explor/i });
    await expect(exploreLink).toBeVisible();
  });

  test("has a back link to immersive", async ({ page }) => {
    await page.goto("/favorites");

    // The header contains a back arrow link (first link in header)
    const header = page.locator("header");
    const backLink = header.locator('a[href="/immersive"]');
    await expect(backLink).toBeVisible();
  });

  test("shows header with title", async ({ page }) => {
    await page.goto("/favorites");

    // Should have the favorites header with bookmark icon and title
    const header = page.locator("header");
    await expect(header).toBeVisible();
  });
});
