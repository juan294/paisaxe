/**
 * Base test fixture for Playwright E2E tests.
 *
 * Extends the default Playwright test with automatic Supabase mocking.
 * In CI, the app runs with dummy Supabase credentials (example.supabase.co)
 * which is NXDOMAIN. Without mocking, client-side Supabase calls hang
 * waiting for DNS resolution, causing all pages to show loading spinners.
 *
 * This fixture intercepts:
 * - Supabase Auth API → returns "not authenticated" (anonymous visitor)
 * - Supabase REST API → returns empty results (triggers fallback stories)
 */

import { test as base, expect } from "@playwright/test";

// QA-M1: NavigationHint (src/components/immersive/navigation-hint.tsx) shows a
// full-viewport, click-intercepting overlay for ~3.5s on touch devices with
// phone-sized viewports, unless sessionStorage already has this key set. The
// old fix attempt was a config-level `storageState` JSON seed, but that only
// writes localStorage — Playwright's storageState mechanism cannot restore
// sessionStorage at all — so the seed was inert and every "mobile" project
// test ate the overlay's ~3.5s of blocked pointer events (masked by retries).
// `addInitScript` runs in every new document before any page script, is
// origin-agnostic (unlike the old seed's hardcoded localhost:3100), and
// writes to the right storage, so it actually suppresses the hint.
const NAV_HINT_STORAGE_KEY = "paisaxe-nav-hint-seen";

export const test = base.extend({
  page: async ({ page }, use) => {
    // Block ALL requests to the dummy Supabase host (example.supabase.co).
    // In CI, the app runs with dummy credentials pointing to this NXDOMAIN host.
    // Without this, every Supabase SDK call (auth, REST, realtime) hangs
    // waiting for DNS resolution, causing pages to show loading spinners.
    await page.route(
      (url) => url.hostname === "example.supabase.co",
      (route) => {
        const url = route.request().url();

        // Auth endpoints → 401 (anonymous visitor)
        if (url.includes("/auth/")) {
          return route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ code: 401, msg: "not authenticated" }),
          });
        }

        // REST API → empty results (triggers fallback stories)
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
      }
    );

    await page.addInitScript((key) => {
      window.sessionStorage.setItem(key, "true");
    }, NAV_HINT_STORAGE_KEY);

    await use(page);
  },
});

export { expect };
