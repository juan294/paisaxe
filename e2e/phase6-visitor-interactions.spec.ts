import { test, expect } from "./fixtures/base-test";
import { MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

// Run unchanged visitor modules in a loopback production artifact. Only script
// delivery and external network boundaries are controlled by this probe.
test.describe("Phase 6 visitor navigation readiness", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(baseURL!).hostname);
    // These Spanish-copy probes must select Spanish explicitly now that SSR
    // honors the browser preference. The six-locale matrix is separate.
    await page.context().addCookies([{ name: "paisaxe-locale", value: "es", url: baseURL! }]);
    await page.route((url) => !["localhost", "127.0.0.1", "[::1]", "example.supabase.co"].includes(url.hostname),
      (route) => route.abort("blockedbyclient"));
    await page.route("**/api/feature-flags", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FEATURE_FLAGS),
    }));
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("SSR controls stay disabled while JavaScript is delayed, then one click moves one story", async ({ page, isMobile }, testInfo) => {
    let releaseScripts!: () => void;
    const scriptGate = new Promise<void>((resolve) => { releaseScripts = resolve; });
    let heldScripts = 0;
    await page.route("**/_next/**/*.js*", async (route) => {
      heldScripts++;
      await scriptGate;
      await route.continue();
    });
    try {
      await page.goto("/immersive", { waitUntil: "commit" });
      const next = page.getByTestId("next-story-button");
      const prev = page.getByTestId("prev-story-button");
      await expect(next).toBeVisible();
      await expect(next).toBeDisabled();
      await expect(prev).toBeDisabled();
      expect(heldScripts).toBeGreaterThan(0);
      await expect(page.getByRole("status").filter({ hasText: /cargando|preparando/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /recargar/i })).toBeVisible();
      const readinessScreenshot = testInfo.outputPath("navigation-javascript-held.png");
      await page.screenshot({ path: readinessScreenshot });
      await testInfo.attach("Navigation before hydration", { path: readinessScreenshot, contentType: "image/png" });
      const activeSegment = page.locator('[data-story-index]:has(button[aria-current="page"])');
      const initialIndex = Number(await activeSegment.getAttribute("data-story-index"));
      const total = await page.locator("[data-story-index]").count();
      const initialTitle = await page.getByTestId("story-title").textContent();
      releaseScripts();
      await expect(next).toBeEnabled();
      await expect(prev).toBeEnabled();
      // Hydration itself must not navigate: otherwise a swallowed click could
      // falsely pass the final next-index assertion. Capture this before action.
      expect(await activeSegment.getAttribute("data-story-index")).toBe(String(initialIndex));
      expect(await page.getByTestId("story-title").textContent()).toBe(initialTitle);
      // Exactly one real pointer action. No retry-click or page-side handler invocation.
      if (isMobile) await next.tap();
      else await next.click();
      await expect(activeSegment).toHaveAttribute("data-story-index", String((initialIndex + 1) % total));
      await expect(page.getByTestId("story-title")).not.toHaveText(initialTitle!);
      // Flush the existing navigation transition duration to detect an extra late move.
      await page.waitForTimeout(350);
      await expect(activeSegment).toHaveAttribute("data-story-index", String((initialIndex + 1) % total));
    } finally {
      releaseScripts();
    }
  });

  test("failed JavaScript leaves disabled controls and visible actionable recovery", async ({ page }) => {
    await page.route("**/_next/**/*.js*", (route) => route.abort("failed"));
    await page.goto("/immersive", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("next-story-button")).toBeDisabled();
    await expect(page.getByTestId("prev-story-button")).toBeDisabled();
    await expect(page.locator("p:visible").filter({ hasText: /JavaScript/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /recargar/i })).toBeVisible();
  });

  test("without JavaScript the visitor can find recovery outside the streamed story boundary", async ({ browser, baseURL }, testInfo) => {
    // browser.newContext does not inherit the project's mobile viewport automatically.
    const context = await browser.newContext({
      javaScriptEnabled: false,
      locale: "es-ES",
      baseURL,
      viewport: testInfo.project.use.viewport,
      isMobile: testInfo.project.use.isMobile,
      hasTouch: testInfo.project.use.hasTouch,
    });
    try {
      const page = await context.newPage();
      await page.route((url) => !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
        (route) => route.abort("blockedbyclient"));
      await page.goto("/immersive", { waitUntil: "domcontentloaded" });
      await expect(page.locator("p:visible").filter({ hasText: /JavaScript/i })).toBeVisible();
      // The static root fallback is English even before request-specific content streams.
      const recovery = page.getByRole("link", { name: "Reload the page", exact: true });
      await expect(recovery).toBeVisible();
      await expect(recovery).toHaveAttribute("href", "/immersive");
    } finally {
      await context.close();
    }
  });
});
