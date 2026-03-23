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

    await use(page);
  },
});

export { expect };
