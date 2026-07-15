import { test, expect } from "./fixtures/base-test";
import type { APIRequestContext } from "@playwright/test";

/**
 * Negative-path smokes: every webhook route must reject a request that is
 * missing (or has an invalid) signature/secret with a 4xx status and a
 * non-empty error body, without leaking a stack trace. The signature
 * verification logic itself is unit-covered (Security Agent); these confirm
 * the route wiring rejects unsigned traffic end-to-end.
 */
async function expectRejected(
  request: APIRequestContext,
  path: string,
  opts: Parameters<APIRequestContext["post"]>[1],
  checkStack = true
) {
  const response = await request.post(path, opts);
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
  if (checkStack) {
    expect(JSON.stringify(body)).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  }
}

test.describe("Webhook signature rejection", () => {
  test("stripe webhook rejects a request with no stripe-signature header", async ({
    request,
  }) => {
    await expectRejected(request, "/api/webhooks/stripe", {
      data: JSON.stringify({ type: "checkout.session.completed" }),
      headers: { "content-type": "application/json" },
    });
  });

  test("elevenlabs webhook rejects a request with no elevenlabs-signature header", async ({
    request,
  }) => {
    await expectRejected(request, "/api/webhooks/elevenlabs", {
      data: JSON.stringify({ event_type: "post_call_transcription" }),
      headers: { "content-type": "application/json" },
    });
  });

  test("supabase webhook rejects a request with no x-webhook-secret header", async ({
    request,
  }) => {
    await expectRejected(request, "/api/webhooks/supabase", {
      data: {
        table_name: "stories",
        operation: "UPDATE",
        timestamp: new Date().toISOString(),
      },
    });
  });

  test("translate webhook rejects a request with no x-webhook-secret header", async ({
    request,
  }) => {
    await expectRejected(request, "/api/webhooks/translate", {
      data: { storyId: "00000000-0000-0000-0000-000000000000" },
    });
  });

  test("supabase webhook rejects a mismatched x-webhook-secret header", async ({
    request,
  }) => {
    await expectRejected(
      request,
      "/api/webhooks/supabase",
      {
        data: {
          table_name: "stories",
          operation: "UPDATE",
          timestamp: new Date().toISOString(),
        },
        headers: { "x-webhook-secret": "not-the-real-secret" },
      },
      false
    );
  });
});
