import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FrameLocator } from "@playwright/test";
import { test, expect } from "./fixtures/auth";

const STRIPE_TIMEOUT_MS = 30_000;
const TALK_BUTTON_TEXT = /Talk|Hablar|Parler|Sprechen|Falar/i;
const START_TALKING_TEXT =
  /Start Talking|Empezar a Hablar|Commencer à Parler|Jetzt Sprechen|Começar a Falar/i;
const UPGRADE_CTA_TEXT =
  /Use your voice|Usa tu voz|Utilisez votre voix|Nutze deine Stimme|Usa la to voz/i;

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

async function getTestUserId(
  supabaseAdmin: SupabaseClient,
  testUserEmail: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("user_id")
    .eq("email", testUserEmail)
    .single();

  if (error || !data?.user_id) {
    throw new Error(`Failed to resolve QA test user: ${error?.message ?? "not found"}`);
  }

  return data.user_id;
}

async function getActiveStorySlug(supabaseAdmin: SupabaseClient): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("stories")
    .select("slug")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(1)
    .single();

  if (error || !data?.slug) {
    throw new Error(`Failed to resolve an active story slug: ${error?.message ?? "not found"}`);
  }

  return data.slug;
}

async function cleanupVoicePurchases(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("voice_purchases")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to clean up voice purchases: ${error.message}`);
  }
}

async function fillFirstVisible(
  frame: FrameLocator,
  selectors: string[],
  value: string,
) {
  for (const selector of selectors) {
    const locator = frame.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
      return;
    }
  }

  throw new Error(`Unable to find Stripe input for selectors: ${selectors.join(", ")}`);
}

test.describe("Real Stripe checkout", () => {
  test("grants voice access end-to-end in Stripe test mode", async ({
    authenticatedPage,
    supabaseAdmin,
    testUserEmail,
  }) => {
    test.skip(
      !process.env.STRIPE_TEST_SECRET_KEY ||
        !process.env.STRIPE_TEST_WEBHOOK_SECRET ||
        !process.env.STRIPE_TEST_DAY_PASS_PRICE_ID,
      "requires Stripe test-mode credentials",
    );

    const stripe = new Stripe(requireEnv("STRIPE_TEST_SECRET_KEY"));
    const webhookSecret = requireEnv("STRIPE_TEST_WEBHOOK_SECRET");
    const userId = await getTestUserId(supabaseAdmin, testUserEmail);
    const storySlug = await getActiveStorySlug(supabaseAdmin);

    await cleanupVoicePurchases(supabaseAdmin, userId);

    try {
      await authenticatedPage.goto(`/pricing/checkout?returnTo=${storySlug}`);
      await expect(authenticatedPage.locator("#checkout iframe").first()).toBeVisible({
        timeout: STRIPE_TIMEOUT_MS,
      });

      const checkoutFrame = authenticatedPage.frameLocator("#checkout iframe").first();

      await fillFirstVisible(
        checkoutFrame,
        [
          "input[autocomplete='cc-number']",
          "input[name='number']",
          "input[placeholder*='1234']",
        ],
        "4242424242424242",
      );
      await fillFirstVisible(
        checkoutFrame,
        [
          "input[autocomplete='cc-exp']",
          "input[name='expiry']",
          "input[placeholder*='MM']",
        ],
        "12 / 34",
      );
      await fillFirstVisible(
        checkoutFrame,
        [
          "input[autocomplete='cc-csc']",
          "input[name='cvc']",
          "input[placeholder='CVC']",
        ],
        "123",
      );

      await fillFirstVisible(
        checkoutFrame,
        [
          "input[autocomplete='postal-code']",
          "input[name='postalCode']",
          "input[name='postal_code']",
        ],
        "28001",
      );

      await checkoutFrame
        .getByRole("button", { name: /Pay|Pagar|Payer|Bezahlen/i })
        .click();

      await authenticatedPage.waitForURL(/\/pricing\/checkout\/return\?session_id=/, {
        timeout: STRIPE_TIMEOUT_MS,
      });

      const sessionId = authenticatedPage.url().match(/[?&]session_id=([^&]+)/)?.[1];
      expect(sessionId).toBeTruthy();

      const session = await stripe.checkout.sessions.retrieve(sessionId!);
      const event = {
        id: `evt_local_${Date.now()}`,
        object: "event",
        api_version: null,
        created: Math.floor(Date.now() / 1000),
        data: { object: session },
        livemode: false,
        pending_webhooks: 1,
        request: { id: null, idempotency_key: null },
        type: "checkout.session.completed",
      };
      const payload = JSON.stringify(event);
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
      });

      const webhookResponse = await authenticatedPage.request.post("/api/webhooks/stripe", {
        data: payload,
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
      });

      expect(webhookResponse.ok()).toBe(true);

      await expect
        .poll(
          async () => {
            const { data, error } = await supabaseAdmin
              .from("voice_purchases")
              .select("payment_provider_id")
              .eq("user_id", userId)
              .eq("payment_provider_id", session.id)
              .maybeSingle();

            if (error) {
              throw error;
            }

            return data?.payment_provider_id ?? null;
          },
          { timeout: STRIPE_TIMEOUT_MS },
        )
        .toBe(session.id);

      await authenticatedPage.reload();
      await expect(authenticatedPage.getByRole("link", { name: START_TALKING_TEXT })).toBeVisible();

      await authenticatedPage.getByRole("link", { name: START_TALKING_TEXT }).click();
      await authenticatedPage.waitForURL(new RegExp(`/immersive\\?story=${storySlug}&voice=ready`), {
        timeout: STRIPE_TIMEOUT_MS,
      });
      await expect(authenticatedPage.getByRole("button", { name: TALK_BUTTON_TEXT })).toBeVisible();
      await expect(authenticatedPage.getByRole("link", { name: UPGRADE_CTA_TEXT })).toHaveCount(0);
    } finally {
      await cleanupVoicePurchases(supabaseAdmin, userId);
    }
  });
});
