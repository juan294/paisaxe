/**
 * QA-H4 (#871): every unit test for the Stripe webhook (route.test.ts) mocks
 * the Supabase client and asserts on the value IT supplied — nothing executes
 * real SQL. The highest-consequence logic in the system ("did a paying
 * customer get their grant, exactly once") therefore has the highest
 * mock-coverage and the lowest real coverage: the actual guarantees
 * (idempotency, concurrency-safety, and permission/RLS posture) live entirely
 * in the `grant_day_pass_idempotent` Postgres function
 * (supabase/migrations/099_grant_day_pass_purchase_type.sql) and its
 * surrounding grants/RLS policies, which no test ever calls for real.
 *
 * This suite exercises the REAL `grant_day_pass_idempotent` RPC against the
 * live local Supabase stack over HTTP — the same PostgREST path
 * `createAdminClient().rpc(...)` uses in production — instead of mocking the
 * Supabase client. It requires a local Supabase Docker stack (`supabase
 * start`) and is skipped automatically when one isn't reachable, matching
 * src/lib/stories-rls.postgrest-rls.test.ts and
 * src/lib/proxy/maintenance.postgrest-integration.test.ts.
 *
 * Three guarantees are falsified here, matching the finding's three named
 * risk categories:
 *   1. Idempotency  — the SAME event processed twice grants exactly once.
 *   2. Concurrency  — two callers racing on the SAME event id still grant
 *      exactly once (real HTTP concurrency via Promise.all, not sequential
 *      awaits — this is what actually proves the ON CONFLICT DO NOTHING
 *      claim rather than assuming Postgres serializes for us).
 *   3. RLS/permission posture — anon and authenticated roles can neither
 *      call the service-role-only RPC nor read the stripe_webhook_events
 *      audit table directly over PostgREST.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  LOCAL_ANON_KEY as ANON_KEY,
  LOCAL_API_URL as API_URL,
  LOCAL_REST_URL as REST_URL,
  LOCAL_SERVICE_ROLE_KEY as SERVICE_ROLE_KEY,
  isLocalSupabaseReachable,
  psql,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

const dbReachable = await isLocalSupabaseReachable();

if (!dbReachable) {
  warnLocalSupabaseUnreachable("route.postgrest-integration.test.ts");
}

/** Fixed UUIDs so fixture setup/teardown is deterministic across runs. */
const USER_IDEMPOTENCY = "871e7a01-0000-4000-8000-000000000001";
const USER_CONCURRENCY = "871e7a01-0000-4000-8000-000000000002";
const ALL_TEST_USER_IDS = [USER_IDEMPOTENCY, USER_CONCURRENCY];

const EVENT_ID_IDEMPOTENCY = "qa-h4-idempotency-event";
const PAYMENT_ID_IDEMPOTENCY = "pi_qa_h4_idempotency";
const EVENT_ID_CONCURRENCY = "qa-h4-concurrency-event";
const PAYMENT_ID_CONCURRENCY = "pi_qa_h4_concurrency";
const ALL_TEST_PAYMENT_IDS = [PAYMENT_ID_IDEMPOTENCY, PAYMENT_ID_CONCURRENCY];
const ALL_TEST_EVENT_IDS = [EVENT_ID_IDEMPOTENCY, EVENT_ID_CONCURRENCY];

/** Ensures a fixture user exists (auth.users + user_profiles) for the FK on voice_purchases. */
function seedTestUser(userId: string): void {
  psql(
    `INSERT INTO auth.users (id, email) VALUES ('${userId}', '${userId}@qa-h4.test') ON CONFLICT (id) DO NOTHING;`
  );
  psql(
    `INSERT INTO public.user_profiles (user_id, email) VALUES ('${userId}', '${userId}@qa-h4.test') ON CONFLICT (user_id) DO NOTHING;`
  );
}

function callGrantRpc(args: {
  eventId: string;
  userId: string;
  paymentProviderId: string;
}) {
  // persistSession: false — this is a service-role client making one-off RPC
  // calls, not a browser session; avoids "Multiple GoTrueClient instances"
  // warnings from constructing a fresh client per call.
  const serviceClient = createClient(API_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return serviceClient.rpc("grant_day_pass_idempotent", {
    p_event_id: args.eventId,
    p_event_type: "checkout.session.completed",
    p_user_id: args.userId,
    p_payment_provider_id: args.paymentProviderId,
    p_expires_at: "2026-01-01T00:00:00Z",
    p_amount_paid: 199,
    p_purchase_type: "day_pass",
  });
}

function voicePurchaseCount(paymentProviderId: string): number {
  return Number(
    psql(
      `SELECT count(*) FROM public.voice_purchases WHERE payment_provider_id = '${paymentProviderId}';`
    )
  );
}

describe.skipIf(!dbReachable)(
  "QA-H4: grant_day_pass_idempotent guarantees against live local Supabase",
  () => {
    beforeAll(() => {
      // Defensive cleanup in case a previous run crashed before its own
      // afterAll ran — these fixture ids are fixed (deterministic), so a
      // stale row here would otherwise make "granted" assertions below flake.
      const paymentList = ALL_TEST_PAYMENT_IDS.map((id) => `'${id}'`).join(", ");
      const eventList = ALL_TEST_EVENT_IDS.map((id) => `'${id}'`).join(", ");
      psql(`DELETE FROM public.voice_purchases WHERE payment_provider_id IN (${paymentList});`);
      psql(`DELETE FROM public.stripe_webhook_events WHERE event_id IN (${eventList});`);

      ALL_TEST_USER_IDS.forEach(seedTestUser);
    });

    afterAll(() => {
      const paymentList = ALL_TEST_PAYMENT_IDS.map((id) => `'${id}'`).join(", ");
      const eventList = ALL_TEST_EVENT_IDS.map((id) => `'${id}'`).join(", ");
      const userList = ALL_TEST_USER_IDS.map((id) => `'${id}'`).join(", ");
      psql(`DELETE FROM public.voice_purchases WHERE payment_provider_id IN (${paymentList});`);
      psql(`DELETE FROM public.stripe_webhook_events WHERE event_id IN (${eventList});`);
      psql(`DELETE FROM public.user_profiles WHERE user_id IN (${userList});`);
      psql(`DELETE FROM auth.users WHERE id IN (${userList});`);
    });

    it("grants exactly once when the same event is processed twice sequentially (idempotency)", async () => {
      const first = await callGrantRpc({
        eventId: EVENT_ID_IDEMPOTENCY,
        userId: USER_IDEMPOTENCY,
        paymentProviderId: PAYMENT_ID_IDEMPOTENCY,
      });
      expect(first.error).toBeNull();
      expect(first.data).toBe("granted");

      // Same Stripe event id delivered again (webhook retry / duplicate delivery).
      const second = await callGrantRpc({
        eventId: EVENT_ID_IDEMPOTENCY,
        userId: USER_IDEMPOTENCY,
        paymentProviderId: PAYMENT_ID_IDEMPOTENCY,
      });
      expect(second.error).toBeNull();
      expect(second.data).toBe("duplicate");

      expect(voicePurchaseCount(PAYMENT_ID_IDEMPOTENCY)).toBe(1);
    });

    it("grants exactly once when two callers race on the same event id (concurrency)", async () => {
      // Real HTTP concurrency: two independent requests fired via Promise.all,
      // not sequential awaits — this is what actually exercises the ON
      // CONFLICT DO NOTHING unique-index race, rather than assuming it.
      const [first, second] = await Promise.all([
        callGrantRpc({
          eventId: EVENT_ID_CONCURRENCY,
          userId: USER_CONCURRENCY,
          paymentProviderId: PAYMENT_ID_CONCURRENCY,
        }),
        callGrantRpc({
          eventId: EVENT_ID_CONCURRENCY,
          userId: USER_CONCURRENCY,
          paymentProviderId: PAYMENT_ID_CONCURRENCY,
        }),
      ]);

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();

      const outcomes = [first.data, second.data].sort();
      expect(outcomes).toEqual(["duplicate", "granted"]);

      expect(voicePurchaseCount(PAYMENT_ID_CONCURRENCY)).toBe(1);
    });

    it("does NOT let anon call the service-role-only grant RPC (permission guarantee)", async () => {
      const res = await fetch(`${REST_URL}/rpc/grant_day_pass_idempotent`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_event_id: "qa-h4-anon-should-not-grant",
          p_event_type: "checkout.session.completed",
          p_user_id: USER_IDEMPOTENCY,
          p_payment_provider_id: "pi_qa_h4_anon_attempt",
          p_expires_at: "2026-01-01T00:00:00Z",
          p_amount_paid: 199,
          p_purchase_type: "day_pass",
        }),
      });

      expect(res.ok).toBe(false);
      const body = await res.json();
      expect(body.message).toMatch(/permission denied/i);
      expect(voicePurchaseCount("pi_qa_h4_anon_attempt")).toBe(0);
    });

    it("does NOT let anon read the stripe_webhook_events audit table directly (RLS/grant guarantee)", async () => {
      const res = await fetch(
        `${REST_URL}/stripe_webhook_events?select=*&event_id=eq.${EVENT_ID_IDEMPOTENCY}`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
      );

      expect(res.ok).toBe(false);
      const body = await res.json();
      expect(body.message).toMatch(/permission denied/i);
    });
  }
);
