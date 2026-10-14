import { test, expect } from "./fixtures/base-test";
import type { Page, TestInfo } from "@playwright/test";
import { MOCK_FEATURE_FLAGS } from "./fixtures/mock-data";

// Anonymous, loopback-only proof of our checkout controls. This deliberately
// never initiates OAuth, /api/checkout/embedded, or a Stripe iframe/session.
// The installed SDK eagerly requests its bootstrap asset on import; that exact
// asset stays blocked and is disclosed separately from active checkout attempts.
// Provider iframe reflow and a completed payment are outside this evidence.
test.describe("Phase 6 normal-flow visitor legal footer", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(baseURL!).hostname);
    await page.route((url) => !["localhost", "127.0.0.1", "[::1]", "example.supabase.co"].includes(url.hostname),
      (route) => route.abort("blockedbyclient"));
    await page.route("**/api/checkout/embedded", (route) => route.abort("blockedbyclient"));
    await page.route((url) => url.pathname.includes("/auth/v1/authorize"), (route) => route.abort("blockedbyclient"));
    await page.route("**/api/feature-flags", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FEATURE_FLAGS),
    }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("paisaxe-locale", "es"));
  });

  async function screenshot(page: Page, info: TestInfo, name: string) {
    const path = info.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await info.attach(name, { path, contentType: "image/png" });
  }

  async function tabToTerms(page: Page) {
    const terms = page.getByRole("contentinfo").getByRole("link", { name: "Condiciones de Uso" });
    // Native keyboard traversal, never locator.focus()/DOM focus(). Each route
    // has a bounded number of controls; failure cannot silently skip a link.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      if (await terms.evaluate((node) => node === document.activeElement)) break;
    }
    await expect(terms).toBeFocused();
    expect(await terms.evaluate((node) => {
      const css = getComputedStyle(node);
      return css.boxShadow !== "none" || (css.outlineStyle !== "none" && parseFloat(css.outlineWidth) > 0);
    })).toBe(true);
    return terms;
  }

  for (const route of ["/pricing", "/pricing/checkout", "/favorites"]) {
    test(`${route} exposes focused legal links in flow and both local legal destinations`, async ({ page }, info) => {
      await page.goto(route);
      const footer = page.getByRole("contentinfo");
      await expect(footer).toHaveCount(1);
      await expect(footer).toBeVisible();
      expect(await footer.evaluate((node) => getComputedStyle(node).position)).toBe("static");
      const terms = await tabToTerms(page);
      await expect(terms).toHaveAttribute("href", "/terms");
      await screenshot(page, info, `${route.replace(/\//g, "-")}-terms-native-focus`);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/terms(?:\?|$)/);
      await expect(page.getByRole("heading", { level: 1, name: "Términos de Servicio", exact: true })).toBeVisible();

      await page.goto(route);
      await tabToTerms(page);
      await page.keyboard.press("Tab");
      const privacy = page.getByRole("contentinfo").getByRole("link", { name: "Política de Privacidad" });
      await expect(privacy).toBeFocused();
      await expect(privacy).toHaveAttribute("href", "/privacy");
      expect(await privacy.evaluate((node) => {
        const css = getComputedStyle(node);
        return css.boxShadow !== "none" || (css.outlineStyle !== "none" && parseFloat(css.outlineWidth) > 0);
      })).toBe(true);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/privacy(?:\?|$)/);
      await expect(page.getByRole("heading", { level: 1, name: "Política de Privacidad", exact: true })).toBeVisible();
    });
  }

  test("anonymous checkout stays unobscured at 320 CSS pixels and 200% root text size", async ({ page }, info) => {
    const checkoutRequests: string[] = [];
    const bootstrapRequests: string[] = [];
    const blockedBootstrap: string[] = [];
    const blockedBootstrapDetails: Array<{ url: string; method: string; resourceType: string; abort: string }> = [];
    const bootstrapUrl = "https://js.stripe.com/dahlia/stripe.js";
    await page.route(bootstrapUrl, async (route) => {
      const request = route.request();
      if (request.url() === bootstrapUrl && request.method() === "GET" && request.resourceType() === "script") {
        await route.abort("blockedbyclient");
        blockedBootstrap.push(request.url());
        blockedBootstrapDetails.push({ url: request.url(), method: request.method(), resourceType: request.resourceType(), abort: "blockedbyclient" });
      } else {
        checkoutRequests.push(request.url());
        await route.abort("blockedbyclient");
      }
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.url() === bootstrapUrl && request.method() === "GET" && request.resourceType() === "script") {
        bootstrapRequests.push(request.url());
      } else if (url.pathname === "/api/checkout/embedded" || url.pathname.includes("/auth/v1/authorize") ||
        url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com") ||
        url.hostname === "accounts.google.com" || url.hostname.endsWith(".accounts.google.com")) {
        checkoutRequests.push(request.url());
      }
    });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/pricing/checkout");
    const control = page.getByRole("button", { name: "Continuar con Google" });
    const footer = page.getByRole("contentinfo");
    await expect(control).toBeVisible();
    await expect(page.locator("#checkout")).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(footer).toHaveCount(1);
    const initialControlHeight = (await control.boundingBox())!.height;

    for (const enlarged of [false, true]) {
      if (enlarged) {
        // CSS root font enlargement, explicitly not browser/device zoom.
        // The separate 320px viewport is the WCAG reflow-width control.
        await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      }
      await control.scrollIntoViewIfNeeded();
      const geometry = await control.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const footer = document.querySelector("footer")!;
        const footerBox = footer.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          left: box.left, right: box.right, width: window.innerWidth,
          footerAfterControl: footerBox.top >= box.bottom,
          footerPosition: getComputedStyle(footer).position,
          hitControl: hit === node || node.contains(hit),
        };
      });
      expect(geometry.overflow).toBe(false);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.width);
      expect(geometry.footerAfterControl).toBe(true);
      expect(geometry.footerPosition).toBe("static");
      expect(geometry.hitControl).toBe(true);
      if (enlarged) expect((await control.boundingBox())!.height).toBeGreaterThan(initialControlHeight);
      await screenshot(page, info, enlarged ? "checkout-320csspx-root-text-200percent" : "checkout-320csspx");
      await footer.scrollIntoViewIfNeeded();
      for (const link of await footer.getByRole("link").all()) {
        const box = (await link.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
      }
      await screenshot(page, info, enlarged ? "footer-320csspx-root-text-200percent" : "footer-320csspx");
    }
    expect(checkoutRequests).toEqual([]);
    await expect.poll(() => blockedBootstrap.length).toBe(bootstrapRequests.length);
    expect(blockedBootstrap).toEqual(bootstrapRequests);
    await info.attach("Blocked passive Stripe bootstrap; no active checkout attempts", {
      body: JSON.stringify({ bootstrapRequests, blockedBootstrap, blockedBootstrapDetails, checkoutRequests }), contentType: "application/json",
    });
  });
});
