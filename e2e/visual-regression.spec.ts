import { test, expect } from "./fixtures/base-test";
import type { Page } from "@playwright/test";
import { MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

/**
 * Visual regression tests — screenshot comparison for key pages.
 *
 * Baselines are generated on CI (Ubuntu + Chromium) to ensure consistency.
 * macOS renders fonts differently, so local runs may show false diffs.
 *
 * Run: npm run test:e2e:visual
 * Update baselines: npm run test:e2e:visual:update (or trigger the GitHub Actions workflow)
 */

/** Disable animations/transitions and wait for fonts + images to load. */
async function stabilizePage(page: Page): Promise<void> {
  // Inject CSS to kill all animations and transitions
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);

  // Wait for all images to complete loading
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll("img"));
    await Promise.all(
      images
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve());
              img.addEventListener("error", () => resolve());
            })
        )
    );
  });

  // Allow layout to settle
  await page.waitForTimeout(300);
}

test.describe("Visual regression — public pages", () => {
  test.beforeEach(async ({ page }) => {
    // Mock feature flags for consistent rendering
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEATURE_FLAGS),
      })
    );

    // Mock auth endpoints — unauthenticated state
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      })
    );

    // Mock voice access check — unauthenticated
    await page.route("**/api/voice/access", (route) =>
      route.fulfill({ status: 401 })
    );
  });

  test("pricing page", async ({ page }) => {
    await page.goto("/pricing");
    await stabilizePage(page);

    await expect(page).toHaveScreenshot("pricing.png", {
      fullPage: true,
    });
  });

  test("immersive page", async ({ page }) => {
    await page.goto("/immersive");

    // Wait for story content to render
    const title = page.getByTestId("story-title").first();
    await expect(title).toBeVisible({ timeout: 15000 });
    await stabilizePage(page);

    // Mask the story background image — external/dynamic content
    await expect(page).toHaveScreenshot("immersive.png", {
      mask: [page.locator("[data-testid='story-background-image']")],
    });
  });

  test("pricing checkout — unauthenticated prompt", async ({ page }) => {
    await page.goto("/pricing/checkout");
    await stabilizePage(page);

    await expect(page).toHaveScreenshot("pricing-checkout-unauth.png", {
      fullPage: true,
    });
  });

  test("favorites page — empty state", async ({ page }) => {
    await page.goto("/favorites");
    await stabilizePage(page);

    await expect(page).toHaveScreenshot("favorites-empty.png", {
      fullPage: true,
    });
  });

  test("about page", async ({ page }) => {
    await page.goto("/about");
    await stabilizePage(page);

    await expect(page).toHaveScreenshot("about.png", {
      fullPage: true,
    });
  });

  test("privacy policy page", async ({ page }) => {
    await page.goto("/privacy");
    await stabilizePage(page);

    await expect(page).toHaveScreenshot("privacy.png", {
      fullPage: true,
    });
  });

  test("terms of service page", async ({ page }) => {
    await page.goto("/terms");
    await stabilizePage(page);

    await expect(page).toHaveScreenshot("terms.png", {
      fullPage: true,
    });
  });

  test("coming soon page", async ({ page }) => {
    await page.goto("/coming-soon");
    await stabilizePage(page);

    // Mask animated gradient backgrounds
    await expect(page).toHaveScreenshot("coming-soon.png", {
      fullPage: true,
      mask: [page.locator(".animate-gradient, [class*='animate-']")],
    });
  });
});
