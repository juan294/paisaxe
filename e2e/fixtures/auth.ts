/**
 * Authentication fixtures for Playwright E2E tests
 *
 * Provides authenticated browser contexts for testing user flows.
 * Includes flakiness mitigation: retries, explicit waits, cleanup.
 */

import { test as base, expect, Page, BrowserContext } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Test user credentials from environment
const QA_TEST_EMAIL = process.env.QA_TEST_USER_EMAIL || "";
const QA_TEST_PASSWORD = process.env.QA_TEST_USER_PASSWORD || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

// Check if authenticated tests should run
export const hasAuthCredentials = (): boolean => {
  return !!(QA_TEST_EMAIL && QA_TEST_PASSWORD && SUPABASE_URL && SUPABASE_ANON_KEY);
};

// Validation for test email pattern (safety check)
export const isValidTestEmail = (email: string): boolean => {
  return /^qa-test-[a-z0-9]+@paisaxe\.dev$/.test(email);
};

// Types for our custom fixtures
interface AuthFixtures {
  authenticatedPage: Page;
  authenticatedContext: BrowserContext;
  testUserEmail: string;
  supabaseAdmin: SupabaseClient;
}

/**
 * Sign in via Supabase Auth API and inject session into browser
 * This is more reliable than UI-based login for E2E tests
 */
async function signInTestUser(page: Page): Promise<{ userId: string }> {
  if (!hasAuthCredentials()) {
    throw new Error("QA test user credentials not configured");
  }

  if (!isValidTestEmail(QA_TEST_EMAIL)) {
    throw new Error(`Invalid test email pattern: ${QA_TEST_EMAIL}`);
  }

  // Create Supabase client for auth
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in with email/password
  const { data, error } = await supabase.auth.signInWithPassword({
    email: QA_TEST_EMAIL,
    password: QA_TEST_PASSWORD,
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  if (!data.session) {
    throw new Error("No session returned from sign in");
  }

  // Inject the session into the browser's localStorage
  // This mimics what Supabase Auth does client-side
  const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

  await page.evaluate(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    },
    { key: storageKey, session: data.session }
  );

  // Reload page to pick up the session
  await page.reload();

  // Wait for auth state to settle (flakiness mitigation)
  await page.waitForTimeout(500);

  return { userId: data.user.id };
}

/**
 * Clean up test user's data (favorites, etc.)
 * Called before and after tests for isolation
 */
async function cleanupTestUserData(): Promise<void> {
  if (!SUPABASE_SERVICE_KEY || !SUPABASE_URL) {
    console.warn("Cannot cleanup: missing service key");
    return;
  }

  if (!isValidTestEmail(QA_TEST_EMAIL)) {
    console.warn("Skipping cleanup: invalid test email");
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/cleanup_qa_test_user`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ test_email: QA_TEST_EMAIL }),
      }
    );

    if (!response.ok) {
      console.warn(`Cleanup returned ${response.status}: ${await response.text()}`);
    }
  } catch (err) {
    console.warn("Cleanup failed:", err);
  }
}

/**
 * Extended test fixture with authenticated page
 */
export const test = base.extend<AuthFixtures>({
  // Provide the test user email for assertions
  testUserEmail: async ({}, use) => {
    await use(QA_TEST_EMAIL);
  },

  // Provide Supabase admin client for direct DB operations
  supabaseAdmin: async ({}, use) => {
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await use(client);
  },

  // Authenticated browser context
  authenticatedContext: async ({ browser }, use) => {
    // Fail loudly if credentials are not configured — silent skips hide CI misconfigurations.
    // Ensure QA_TEST_USER_EMAIL and QA_TEST_USER_PASSWORD are set in the workflow env.
    if (!hasAuthCredentials()) {
      throw new Error(
        "QA test user credentials not configured. Set QA_TEST_USER_EMAIL and QA_TEST_USER_PASSWORD in the CI environment."
      );
    }

    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  // Authenticated page with session injected
  authenticatedPage: async ({ authenticatedContext }, use) => {
    // Fail loudly if credentials are not configured — silent skips hide CI misconfigurations.
    // Ensure QA_TEST_USER_EMAIL and QA_TEST_USER_PASSWORD are set in the workflow env.
    if (!hasAuthCredentials()) {
      throw new Error(
        "QA test user credentials not configured. Set QA_TEST_USER_EMAIL and QA_TEST_USER_PASSWORD in the CI environment."
      );
    }

    // Clean up before test (isolation)
    await cleanupTestUserData();

    const page = await authenticatedContext.newPage();

    // Navigate to app first (needed to set localStorage)
    await page.goto("/");

    // Sign in and inject session
    await signInTestUser(page);

    // Verify auth state is ready (wait for user-dependent UI)
    // This is a flakiness mitigation - wait for auth to propagate
    await page.waitForFunction(
      () => {
        // Check if Supabase auth is initialized
        const keys = Object.keys(localStorage);
        return keys.some((k) => k.includes("auth-token"));
      },
      { timeout: 10000 }
    );

    await use(page);

    // Clean up after test (isolation)
    await cleanupTestUserData();
    await page.close();
  },
});

export { expect };
