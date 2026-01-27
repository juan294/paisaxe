import { test, expect } from "@playwright/test";
import { MOCK_ADMIN_STORIES, TEST_ADMIN_KEY } from "./fixtures/mock-data";

test.describe("Admin page", () => {
  test("shows login form", async ({ page }) => {
    await page.goto("/admin");

    // Login form should be visible
    await expect(page.getByText("Paisaxe Admin")).toBeVisible();
    await expect(page.getByText("Enter your access key to continue")).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("shows error for empty key submission", async ({ page }) => {
    await page.goto("/admin");

    // Submit without entering a key
    await page.getByRole("button", { name: /continue/i }).click();

    // Error message should appear
    await expect(page.getByText("Please enter the admin key")).toBeVisible();
  });

  test("rejects invalid admin key", async ({ page }) => {
    // Mock the admin stories API to return 403 for invalid key
    await page.route("**/api/admin/stories*", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid admin key" }),
      })
    );

    await page.goto("/admin");

    // Enter a wrong key
    await page.locator('input[type="password"]').fill("wrong-key");
    await page.getByRole("button", { name: /continue/i }).click();

    // Should show "Invalid admin key" error
    await expect(page.getByText("Invalid admin key")).toBeVisible({ timeout: 5000 });
  });

  test("logs in with correct key and shows dashboard", async ({ page }) => {
    // Mock the admin stories API to accept the test key
    await page.route("**/api/admin/stories*", (route) => {
      const auth = route.request().headers()["authorization"];
      if (auth === `Bearer ${TEST_ADMIN_KEY}`) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_ADMIN_STORIES),
        });
      }
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid admin key" }),
      });
    });

    await page.goto("/admin");

    // Enter the test admin key
    await page.locator('input[type="password"]').fill(TEST_ADMIN_KEY);
    await page.getByRole("button", { name: /continue/i }).click();

    // Should show admin dashboard header
    await expect(page.getByText("Paisaxe Admin").first()).toBeVisible({ timeout: 5000 });

    // Should show a Logout button (icon-only on mobile, text on desktop)
    const logoutButton = page.locator("button").filter({ has: page.locator("svg.lucide-log-out") });
    await expect(logoutButton).toBeVisible();
  });
});
