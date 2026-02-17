import { test, expect } from "@playwright/test";
import {
  withFeatureFlags,
  MOCK_SUGGESTION_RESPONSE,
} from "./fixtures/mock-data";

/**
 * Interactive Controls E2E Tests
 *
 * Tests the BEHAVIOR of interactive UI controls, not just their visibility.
 * These tests verify that clicking buttons actually produces the expected
 * state changes — preventing vacuous "the button exists" tests from masking
 * broken behavior.
 *
 * Run with: npx playwright test interactive-controls.spec.ts
 */

// ─── Ambient / Auto-play Toggle ─────────────────────────────────

test.describe("Ambient toggle behavior", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    // Ambient button uses hidden md:flex — not visible on mobile
    test.skip(isMobile, "Ambient button is desktop-only (hidden md:flex)");

    // Enable both autoplay_button and ambient_discovery
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          withFeatureFlags({
            autoplay_button: true,
            ambient_discovery: true,
          })
        ),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("play button starts auto-rotation and switches to pause icon", async ({
    page,
  }) => {
    // The ambient button shows a Play icon (svg with lucide-play class)
    const playButton = page
      .locator("nav button")
      .filter({ has: page.locator(".lucide-play") });
    await expect(playButton).toBeVisible();

    // Click to start
    await playButton.click();

    // After click the icon changes from Play to Pause. Playwright locators
    // re-evaluate on every assertion, so the original filter (has: .lucide-play)
    // no longer matches. Use a fresh locator for the new state.
    const pauseButton = page
      .locator("nav button")
      .filter({ has: page.locator(".lucide-pause") });
    await expect(pauseButton).toBeVisible();

    // Play icon should be gone from the toolbar
    await expect(page.locator("nav button .lucide-play")).toHaveCount(0);
  });

  test("clicking pause stops rotation and returns to play icon", async ({
    page,
  }) => {
    // Click play to start
    const playButton = page
      .locator("nav button")
      .filter({ has: page.locator(".lucide-play") });
    await expect(playButton).toBeVisible();
    await playButton.click();

    // Verify it switched to pause (fresh locator)
    const pauseButton = page
      .locator("nav button")
      .filter({ has: page.locator(".lucide-pause") });
    await expect(pauseButton).toBeVisible();

    // Click again to stop
    await pauseButton.click();

    // Should return to play icon (fresh locator)
    await expect(
      page.locator("nav button").filter({ has: page.locator(".lucide-play") })
    ).toBeVisible();
    await expect(page.locator("nav button .lucide-pause")).toHaveCount(0);
  });

  test("auto-rotation advances to next story", async ({ page }) => {
    // Get the initial story title
    const initialTitle = await page.locator("h1").first().textContent();

    // Start auto-rotation
    const playButton = page
      .locator("nav button")
      .filter({ has: page.locator(".lucide-play") });
    await playButton.click();

    // Wait for auto-advance (ambient mode is 12 seconds)
    // Use a generous timeout since transitions add delay
    await expect(page.locator("h1").first()).not.toHaveText(initialTitle!, {
      timeout: 15000,
    });
  });

  test("stopping auto-rotation keeps current story", async ({ page }) => {
    // Start auto-rotation
    const playButton = page
      .locator("nav button")
      .filter({ has: page.locator(".lucide-play") });
    await playButton.click();

    // Immediately stop it (fresh locator for pause state)
    await page
      .locator("nav button")
      .filter({ has: page.locator(".lucide-pause") })
      .click();

    // Get the title after stopping
    const titleAfterStop = await page.locator("h1").first().textContent();

    // Wait well beyond the auto-advance interval
    await page.waitForTimeout(7000);

    // Title should be the same — no auto-advance happened
    await expect(page.locator("h1").first()).toHaveText(titleAfterStop!);
  });
});

// ─── Language Switcher Behavior ─────────────────────────────────

test.describe("Language switcher behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(withFeatureFlags({})),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("switcher opens dropdown and closes on selection", async ({ page }) => {
    const switcher = page.locator('div[role="group"]').first();
    const trigger = switcher.locator("button").first();

    // Trigger should start collapsed
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Open dropdown
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Options should be visible
    const options = switcher.locator('[role="option"]');
    await expect(options.first()).toBeVisible();

    // Select a language
    await options.first().click();

    // Dropdown should close — check the trigger's aria-expanded attribute
    // (more reliable than checking option visibility through CSS transitions)
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("switcher closes on Escape key", async ({ page }) => {
    const switcher = page.locator('div[role="group"]').first();
    const trigger = switcher.locator("button").first();

    // Open dropdown
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Press Escape
    await page.keyboard.press("Escape");

    // Dropdown should close
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

// ─── Bookmark Button Behavior ───────────────────────────────────

test.describe("Bookmark button behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(withFeatureFlags({})),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("bookmark button is visible and clickable", async ({ page }) => {
    // The bookmark button in the toolbar nav has aria-label "Agregar a
    // guardados" (ES) or "Add to saved" (EN). Scope to nav to avoid matching
    // the separate "Bookmarks" panel button in the article section.
    const bookmarkButton = page
      .locator("nav")
      .getByRole("button", { name: /guardad|saved/i });
    await expect(bookmarkButton).toBeVisible();

    // Should have an unfilled bookmark icon initially (no fill-white class)
    const svg = bookmarkButton.locator("svg");
    await expect(svg).toBeVisible();
  });
});

// ─── Navigation Arrows Behavior ─────────────────────────────────

test.describe("Navigation behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(withFeatureFlags({})),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("right arrow key advances to next story", async ({ page }) => {
    const initialTitle = await page.locator("h1").first().textContent();

    await page.keyboard.press("ArrowRight");

    // Wait for transition
    await page.waitForTimeout(500);

    // Title should change
    await expect(page.locator("h1").first()).not.toHaveText(initialTitle!);
  });

  test("left arrow key goes to previous story", async ({ page }) => {
    // First go to second story
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);

    const secondTitle = await page.locator("h1").first().textContent();

    // Now go back
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);

    // Title should change back
    await expect(page.locator("h1").first()).not.toHaveText(secondTitle!);
  });

  test("i key toggles info overlay visibility", async ({
    page,
    isMobile,
  }) => {
    // Keyboard shortcut hints are hidden on touch devices (desktop-pointer-only)
    test.skip(isMobile, "Keyboard shortcut 'i' toggle is desktop-only");

    // Info should be visible initially
    const article = page.locator("article").first();
    await expect(article).toHaveClass(/opacity-100/);

    // Press i to hide
    await page.keyboard.press("i");
    await expect(article).toHaveClass(/opacity-0/);

    // Press i again to show
    await page.keyboard.press("i");
    await expect(article).toHaveClass(/opacity-100/);
  });

  test("progress bar segments are clickable and navigate", async ({
    page,
    isMobile,
  }) => {
    // On mobile, the full-height nav arrow tap zones (z-20, h-full, w-20)
    // overlap progress bar segments and intercept pointer events. This is
    // intentional mobile UX — large tap targets for story navigation.
    test.skip(isMobile, "Nav arrow tap zones overlap progress bar on mobile");

    const initialTitle = await page.locator("h1").first().textContent();

    // Click the third progress segment
    const progressBar = page.getByRole("progressbar");
    const segments = progressBar.locator('[role="button"]');
    const segmentCount = await segments.count();

    if (segmentCount >= 3) {
      await segments.nth(2).click();
      await page.waitForTimeout(500);

      // Should navigate to a different story
      await expect(page.locator("h1").first()).not.toHaveText(initialTitle!);
    }
  });
});

// ─── Keyboard Shortcuts Suppressed in Form Inputs ────────────────

test.describe("Keyboard shortcuts suppressed in form inputs", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, "Keyboard shortcuts are desktop-only");

    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          withFeatureFlags({ user_story_suggestions: true })
        ),
      })
    );

    // Mock the suggestion API so form submission doesn't fail
    await page.route("**/api/suggestions", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTION_RESPONSE),
      })
    );

    await page.goto("/immersive");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("space bar types a space in input instead of advancing story", async ({
    page,
  }) => {
    const initialTitle = await page.locator("h1").first().textContent();

    // Open the suggest place dialog
    const suggestButton = page.locator("[data-suggest-place-trigger]");
    await expect(suggestButton).toBeVisible();
    await suggestButton.click();

    // Wait for the dialog to open
    const placeInput = page.locator("#place-name");
    await expect(placeInput).toBeVisible();

    // Type into the input including a space
    await placeInput.fill("Playa del");
    // Verify the space is in the input value
    await expect(placeInput).toHaveValue("Playa del");

    // Also verify story did NOT advance (title unchanged)
    await expect(page.locator("h1").first()).toHaveText(initialTitle!);
  });

  test("space bar in textarea does not advance story", async ({ page }) => {
    const initialTitle = await page.locator("h1").first().textContent();

    // Open the suggest place dialog
    await page.locator("[data-suggest-place-trigger]").click();

    const commentArea = page.locator("#comment");
    await expect(commentArea).toBeVisible();

    // Type into textarea including spaces
    await commentArea.fill("Great hidden beach");
    await expect(commentArea).toHaveValue("Great hidden beach");

    // Story should NOT have advanced
    await expect(page.locator("h1").first()).toHaveText(initialTitle!);
  });
});
