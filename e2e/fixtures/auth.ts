/**
 * Authentication fixtures for Playwright E2E tests
 *
 * Provides authenticated browser contexts for testing user flows.
 * Includes flakiness mitigation: retries, explicit waits, cleanup.
 */

import { test as base, expect, Page, BrowserContext } from "@playwright/test";
import { createClient, SupabaseClient, type Session } from "@supabase/supabase-js";

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

  // The application uses @supabase/ssr's browser client, which persists auth
  // in base64url-encoded cookies. Writing localStorage here creates a token the
  // application never reads and produces a false "authenticated" fixture.
  const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  await injectSessionCookies(page, storageKey, data.session);

  // Reload page to pick up the session and wait for it to fully load
  await page.reload({ waitUntil: "domcontentloaded" });

  return { userId: data.user.id };
}

async function injectSessionCookies(
  page: Page,
  storageKey: string,
  session: Session,
): Promise<void> {
  const encoded = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  const chunkSize = 3180;
  const values = Array.from(
    { length: Math.ceil(encoded.length / chunkSize) },
    (_, index) => encoded.slice(index * chunkSize, (index + 1) * chunkSize),
  );
  const origin = new URL(page.url()).origin;

  await page.context().addCookies(
    values.map((value, index) => ({
      name: values.length === 1 ? storageKey : `${storageKey}.${index}`,
      value,
      url: origin,
      sameSite: "Lax" as const,
    })),
  );
}

/**
 * Read the Supabase SSR session back from a browser context.
 *
 * @supabase/ssr may split a base64url-encoded session across numbered cookie
 * chunks. Release probes need the access token for direct datastore oracles,
 * so they must read the same cookie storage used by the application rather
 * than the obsolete localStorage key.
 */
export async function readSessionFromAuthCookies(
  context: BrowserContext,
  supabaseUrl: string = SUPABASE_URL,
): Promise<Session | null> {
  if (!supabaseUrl) return null;

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const matchingCookies = (await context.cookies())
    .filter(
      (cookie) =>
        cookie.name === storageKey || cookie.name.startsWith(`${storageKey}.`),
    )
    .sort((left, right) => {
      const chunkIndex = (name: string): number =>
        name === storageKey
          ? 0
          : Number.parseInt(name.slice(storageKey.length + 1), 10);
      return chunkIndex(left.name) - chunkIndex(right.name);
    });

  if (matchingCookies.length === 0) return null;

  const encoded = matchingCookies.map((cookie) => cookie.value).join("");
  if (!encoded.startsWith("base64-")) return null;

  try {
    return JSON.parse(
      Buffer.from(encoded.slice("base64-".length), "base64url").toString(
        "utf8",
      ),
    ) as Session;
  } catch {
    return null;
  }
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

    // Verify the SSR auth cookie reached the browser before handing the page
    // to a test. Page-level assertions still wait for React auth hydration.
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    await expect
      .poll(
        async () =>
          (await authenticatedContext.cookies()).some((cookie) =>
            cookie.name.startsWith(`sb-${projectRef}-auth-token`),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);

    await use(page);

    // Clean up after test (isolation)
    await cleanupTestUserData();
    await page.close();
  },
});

export { expect };
