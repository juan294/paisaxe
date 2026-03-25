import { test, expect } from "./fixtures/base-test";

test.describe("Admin page", () => {
  test("shows Google sign-in page when not authenticated", async ({ page }) => {
    await page.goto("/admin");

    // Title should be visible
    await expect(page.getByText("Paisaxe Admin")).toBeVisible();

    // Should show sign-in prompt (not old "Enter your access key" form)
    await expect(page.getByText("Sign in to access the admin panel")).toBeVisible();

    // Should show Google sign-in button
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();

    // Should show "Protected area" notice
    await expect(page.getByText("Protected area")).toBeVisible();
  });

  test("does not show password input or bearer token form", async ({ page }) => {
    await page.goto("/admin");

    // Old bearer-token login elements should NOT exist
    await expect(page.locator('input[type="password"]')).not.toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).not.toBeVisible();
  });
});
