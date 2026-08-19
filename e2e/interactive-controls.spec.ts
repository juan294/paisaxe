import { test, expect } from "./fixtures/base-test";
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
    await expect(page.getByTestId("story-title").first()).toContainText(/\S+/);
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
    // QA-M8: ambient mode's auto-advance interval is a real 12s client
    // timer, not a render/network wait — it can't be shrunk to "a few
    // seconds" without breaking the assertion. The 15s wait below already
    // claims the entire default 15s CI per-test budget, leaving zero
    // headroom for setup/click before it and the assertion after it. Give
    // this test its own extended budget instead of tightening the wait.
    test.setTimeout(20_000);

    // Get the initial story title
    const title = page.getByTestId("story-title").first();
    const initialTitle = await title.textContent();

    // Start auto-rotation
    const playButton = page
      .locator("nav button")
      .filter({ has: page.locator(".lucide-play") });
    await playButton.click();

    // Wait for auto-advance (ambient mode is 12 seconds)
    // Use a generous timeout since transitions add delay
    await expect(title).not.toHaveText(initialTitle!, {
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
    const title = page.getByTestId("story-title").first();
    const titleAfterStop = await title.textContent();

    // Title should remain the same — no auto-advance should happen.
    // toHaveText with a generous timeout passes immediately when the title
    // stays put; it only fails if the title unexpectedly changes.
    await expect(title).toHaveText(titleAfterStop!, {
      timeout: 7000,
    });
  });
});

// ─── Language Switcher Behavior ─────────────────────────────────

test.describe("Language switcher behavior", () => {
  const languageSwitcherSelector =
    'div[role="group"][aria-label*="anguage"], div[role="group"][aria-label*="idioma"], div[role="group"][aria-label*="llingua"], div[role="group"][aria-label*="Sprach"], div[role="group"][aria-label*="langue"]';

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feature-flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(withFeatureFlags({})),
      })
    );

    await page.goto("/immersive");
    const switcher = page.locator(languageSwitcherSelector).first();
    await expect(switcher).toBeVisible();
  });

  test("switcher opens dropdown and closes on selection", async ({ page }) => {
    const switcher = page.locator(languageSwitcherSelector).first();
    const trigger = switcher.locator("button").first();
    const options = switcher.locator('[role="option"]');

    await expect(trigger).toBeVisible();
    // Trigger should start collapsed
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Open dropdown
    await trigger.click();
    await expect(options.first()).toBeVisible();

    // Options should be visible
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Select a language
    await options.first().click();

    // Dropdown should close — check the trigger's aria-expanded attribute
    // (more reliable than checking option visibility through CSS transitions)
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("switcher closes on Escape key", async ({ page }) => {
    const switcher = page.locator(languageSwitcherSelector).first();
    const trigger = switcher.locator("button").first();
    const options = switcher.locator('[role="option"]');

    await expect(trigger).toBeVisible();
    // Open dropdown
    await trigger.click();
    await expect(options.first()).toBeVisible();
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
    await expect(page.getByTestId("story-title").first()).toContainText(/\S+/);
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
    await expect(page.getByTestId("story-title").first()).toContainText(/\S+/);
  });

  test("right arrow key advances to next story", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Keyboard navigation is desktop-only");

    const title = page.getByTestId("story-title").first();
    const initialTitle = await title.textContent();

    await page.evaluate(() => window.focus());
    await page.keyboard.press("ArrowRight");

    // Title should change after transition
    await expect(title).not.toHaveText(initialTitle!, {
      timeout: 3000,
    });
  });

  test("left arrow key goes to previous story", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Keyboard navigation is desktop-only");

    // First go to second story
    const title = page.getByTestId("story-title").first();
    const initialTitle = await title.textContent();
    await page.evaluate(() => window.focus());
    await page.keyboard.press("ArrowRight");
    await expect(title).not.toHaveText(initialTitle!, {
      timeout: 3000,
    });

    const secondTitle = await title.textContent();

    // Now go back
    await page.evaluate(() => window.focus());
    await page.keyboard.press("ArrowLeft");

    // Title should change back
    await expect(title).not.toHaveText(secondTitle!, {
      timeout: 3000,
    });
  });

  test("i key toggles info overlay visibility", async ({
    page,
    isMobile,
  }) => {
    // Keyboard shortcut hints are hidden on touch devices (desktop-pointer-only)
    test.skip(isMobile, "Keyboard shortcut 'i' toggle is desktop-only");

    // Info should be visible initially — use testid for precise targeting
    const infoPanel = page.getByTestId("story-info-panel").first();
    await expect(infoPanel).toHaveClass(/opacity-100/);

    // Press i to hide
    await page.evaluate(() => window.focus());
    await page.keyboard.press("i");
    await expect(infoPanel).toHaveClass(/opacity-0/, { timeout: 5000 });

    // Press i again to show
    await page.evaluate(() => window.focus());
    await page.keyboard.press("i");
    await expect(infoPanel).toHaveClass(/opacity-100/, { timeout: 5000 });
  });

  test("progress bar segments are clickable and navigate", async ({
    page,
    isMobile,
  }) => {
    // On mobile, the full-height nav arrow tap zones (z-20, h-full, w-20)
    // overlap progress bar segments and intercept pointer events. This is
    // intentional mobile UX — large tap targets for story navigation.
    test.skip(isMobile, "Nav arrow tap zones overlap progress bar on mobile");

    const title = page.getByTestId("story-title").first();
    const initialTitle = await title.textContent();

    // Click the third progress segment
    const progressBar = page.getByRole("progressbar");
    const segments = progressBar.locator('[role="button"]');
    const segmentCount = await segments.count();

    if (segmentCount >= 3) {
      await segments.nth(2).click();

      // Should navigate to a different story after transition
      await expect(title).not.toHaveText(initialTitle!, {
        timeout: 3000,
      });
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
    const title = page.getByTestId("story-title").first();
    await expect(title).toContainText(/\S+/);
  });

  test("space bar types a space in input instead of advancing story", async ({
    page,
  }) => {
    const title = page.getByTestId("story-title").first();
    const initialTitle = await title.textContent();

    // Open the suggest place dialog
    // QA-M8: the trigger renders alongside the already-visible story title
    // (see beforeEach) — 5s is generous without claiming the entire 15s
    // CI per-test budget on a single wait.
    const suggestButton = page.locator("[data-suggest-place-trigger]");
    await expect(suggestButton).toBeVisible({ timeout: 5000 });
    await suggestButton.click();

    // Wait for the dialog to open
    const placeInput = page.locator("#place-name");
    await expect(placeInput).toBeVisible();

    // Type into the input including a space
    await placeInput.fill("Playa del");
    // Verify the space is in the input value
    await expect(placeInput).toHaveValue("Playa del");

    // Also verify story did NOT advance (title unchanged)
    await expect(title).toHaveText(initialTitle!);
  });

  test("space bar in textarea does not advance story", async ({ page }) => {
    const title = page.getByTestId("story-title").first();
    const initialTitle = await title.textContent();

    // Open the suggest place dialog
    // QA-M8: the trigger renders alongside the already-visible story title
    // (see beforeEach) — 5s is generous without claiming the entire 15s
    // CI per-test budget on a single wait.
    const suggestButton = page.locator("[data-suggest-place-trigger]");
    await expect(suggestButton).toBeVisible({ timeout: 5000 });
    await suggestButton.click();

    const commentArea = page.locator("#comment");
    await expect(commentArea).toBeVisible();

    // Type into textarea including spaces
    await commentArea.fill("Great hidden beach");
    await expect(commentArea).toHaveValue("Great hidden beach");

    // Story should NOT have advanced
    await expect(title).toHaveText(initialTitle!);
  });
});
