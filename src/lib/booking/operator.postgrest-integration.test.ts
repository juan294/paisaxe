// @vitest-environment node
/**
 * The operator view and its two actions against the live local stack
 * (PayPal hackathon plan, Phase 5, unit [operator]): merchant scoping,
 * exception flags, hold release and link re-issue, through the library and
 * through the HTTP routes. Requires `supabase start`; self-skips otherwise.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// Live local Supabase: a loaded host can push a test past the 5 s default (#997).
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });
import {
  isLocalSupabaseReachable,
  localServiceClient,
  psql,
  sqlList,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";
import { capabilityRouteState, routeRequest } from "@/test/booking-capability-route";

vi.mock("@/lib/rate-limit", async () => (await import("@/test/booking-capability-route")).rateLimitMock());
// The routes' admin client is the local stack's service-role client.
vi.mock("@/lib/supabase-admin", async () => {
  const { localServiceClient: client } = await import("@/test/local-supabase");
  return { createAdminClient: () => client() };
});

const { loadOperatorView, releaseOperatorHold, reissueBookingLink } = await import("./operator");
const { bookingLink, operatorLink, verifyBookingCapability } = await import("./links");
const { addDays, madridDate } = await import("./types");
const { GET: getView } = await import("@/app/api/operator/[capability]/route");
const { POST: postRelease } = await import("@/app/api/operator/[capability]/holds/[holdId]/release/route");
const { POST: postReissue } = await import("@/app/api/operator/[capability]/bookings/[bookingId]/reissue-link/route");

const dbReachable = await isLocalSupabaseReachable();
if (!dbReachable) warnLocalSupabaseUnreachable("operator.postgrest-integration.test.ts");

const MERCHANT = "b0060000-0000-4000-8000-000000000001";
const OTHER_MERCHANT = "b0060000-0000-4000-8000-000000000002";
const EXPERIENCE = "b0060000-0000-4000-8000-000000000011"; // capacity 6, 10:00 daily
const OTHER_EXPERIENCE = "b0060000-0000-4000-8000-000000000012";
const USER = "b0060000-0000-4000-8000-0000000000a1";
const ACCESS = "b0060000-0000-4000-8000-0000000000c1";
const EXPIRED_ACCESS = "b0060000-0000-4000-8000-0000000000c2";
const EXPERIENCES = sqlList([EXPERIENCE, OTHER_EXPERIENCE]);
const CAPACITY = 6;

const today = () => madridDate(new Date());
let releaseDayOffset = 40;

function cleanup(): void {
  psql(
    `DELETE FROM public.payments WHERE booking_id IN (SELECT id FROM public.bookings WHERE experience_id IN (${EXPERIENCES}));` +
      `DELETE FROM public.bookings WHERE experience_id IN (${EXPERIENCES});` +
      `DELETE FROM public.holds WHERE experience_id IN (${EXPERIENCES});` +
      `DELETE FROM public.quotes WHERE experience_id IN (${EXPERIENCES});` +
      `DELETE FROM public.operator_access WHERE merchant_id IN (${sqlList([MERCHANT, OTHER_MERCHANT])});` +
      `DELETE FROM public.experiences WHERE id IN (${EXPERIENCES});` +
      `DELETE FROM public.merchants WHERE id IN (${sqlList([MERCHANT, OTHER_MERCHANT])});` +
      `DELETE FROM auth.users WHERE id = '${USER}';`
  );
}

interface SeedOptions {
  experience?: string;
  date: string;
  status: string;
  party?: number;
  /** "live" (15 min left), "expired", "consumed" or "released". */
  hold?: "live" | "expired" | "consumed" | "released";
  payment?: { status: string; order?: string; capture?: string; refund?: string };
}

/** Inserts quote, hold and booking (and optionally a payment) directly; returns ids. */
function seedBooking(options: SeedOptions): { bookingId: string; holdId: string } {
  const experience = options.experience ?? EXPERIENCE;
  const party = options.party ?? 2;
  const hold = options.hold ?? "consumed";
  const expires = hold === "expired" ? "now() - interval '1 minute'" : "now() + interval '15 minutes'";
  const consumed = hold === "consumed" ? "now()" : "NULL";
  const released = hold === "released" ? "now()" : "NULL";
  const [bookingId, holdId] = psql(
    `WITH q AS (INSERT INTO public.quotes (user_id, experience_id, version, slot_date, slot_time, party_size, ` +
      `total_cents, deposit_cents, currency, cancellation_window_hours, expires_at) VALUES ('${USER}', '${experience}', 1, ` +
      `'${options.date}', '10:00', ${party}, 12000, 3000, 'EUR', 24, now() + interval '20 minutes') RETURNING id), ` +
      `h AS (INSERT INTO public.holds (quote_id, experience_id, slot_date, slot_time, party_size, expires_at, consumed_at, released_at) ` +
      `SELECT id, '${experience}', '${options.date}', '10:00', ${party}, ${expires}, ${consumed}, ${released} FROM q RETURNING id, quote_id), ` +
      `b AS (INSERT INTO public.bookings (reference, user_id, quote_id, hold_id, experience_id, slot_date, slot_time, party_size, ` +
      `total_cents, deposit_cents, currency, cancellation_window_hours, status) SELECT 'IT6-' || upper(substr(md5(random()::text), 1, 6)), ` +
      `'${USER}', h.quote_id, h.id, '${experience}', '${options.date}', '10:00', ${party}, 12000, 3000, 'EUR', 24, '${options.status}' ` +
      `FROM h RETURNING id, hold_id) SELECT id || '|' || hold_id FROM b;`
  ).split("|");
  if (options.payment) {
    const { status, order, capture, refund } = options.payment;
    const text = (value?: string) => (value ? `'${value}'` : "NULL");
    psql(
      `INSERT INTO public.payments (booking_id, amount_cents, status, order_id, capture_id, refund_id) ` +
        `VALUES ('${bookingId}', 3000, '${status}', ${text(order)}, ${text(capture)}, ${text(refund)});`
    );
  }
  return { bookingId, holdId };
}

const access = { id: ACCESS, merchantId: MERCHANT, label: "IT operator", linkVersion: 1, expiresAt: "2099-01-01T00:00:00Z" };
const capabilityOf = (id: string) => operatorLink({ id, linkVersion: 1 }).slice("/operator/".length);

function available(date: string, experience = EXPERIENCE): number {
  return Number(psql(`SELECT available FROM public.experience_availability('${experience}', '${date}') WHERE start_time = '10:00';`));
}

const holdState = (holdId: string) =>
  psql(`SELECT (consumed_at IS NOT NULL)::text || ':' || (released_at IS NOT NULL)::text FROM public.holds WHERE id = '${holdId}';`);
const linkVersion = (bookingId: string) => Number(psql(`SELECT link_version FROM public.bookings WHERE id = '${bookingId}';`));

const releaseParams = (holdId: string, capability = capabilityOf(ACCESS)) => ({ params: Promise.resolve({ capability, holdId }) });
const reissueParams = (bookingId: string, capability = capabilityOf(ACCESS)) => ({
  params: Promise.resolve({ capability, bookingId }),
});
const release = (holdId: string, capability?: string) =>
  postRelease(routeRequest(`/api/operator/x/holds/${holdId}/release`, { method: "POST" }), releaseParams(holdId, capability));
const reissue = (bookingId: string, capability?: string) =>
  postReissue(routeRequest(`/api/operator/x/bookings/${bookingId}/reissue-link`, { method: "POST" }), reissueParams(bookingId, capability));

describe.skipIf(!dbReachable)("operator view against live local Supabase", () => {
  beforeAll(() => {
    vi.stubEnv("BOOKING_LINK_SECRET", "integration-test-secret-that-is-at-least-32-bytes");
    cleanup();
    psql(`INSERT INTO auth.users (id, email) VALUES ('${USER}', '${USER}@operator-it.test') ON CONFLICT (id) DO NOTHING;`);
    psql(
      `INSERT INTO public.merchants (id, slug, name, timezone, cancellation_window_hours, is_fixture) VALUES ` +
        `('${MERCHANT}', 'it-operator-merchant', 'IT Operator Merchant', 'Europe/Madrid', 24, true), ` +
        `('${OTHER_MERCHANT}', 'it-operator-other', 'IT Other Merchant', 'Europe/Madrid', 24, true);`
    );
    psql(
      `INSERT INTO public.experiences (id, merchant_id, slug, title, price_cents, deposit_cents, max_party, capacity_per_slot, slot_rule) VALUES ` +
        `('${EXPERIENCE}', '${MERCHANT}', 'it-operator-exp', 'IT operator walk', 12000, 3000, 6, ${CAPACITY}, '{"weekdays":[1,2,3,4,5,6,7],"start_times":["10:00"]}'), ` +
        `('${OTHER_EXPERIENCE}', '${OTHER_MERCHANT}', 'it-operator-other-exp', 'IT other walk', 12000, 3000, 6, ${CAPACITY}, '{"weekdays":[1,2,3,4,5,6,7],"start_times":["10:00"]}');`
    );
    psql(
      `INSERT INTO public.operator_access (id, merchant_id, label, expires_at) VALUES ` +
        `('${ACCESS}', '${MERCHANT}', 'IT operator', '2099-01-01T00:00:00Z'), ` +
        `('${EXPIRED_ACCESS}', '${MERCHANT}', 'IT expired operator', now() - interval '1 minute');`
    );
  });

  afterAll(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    capabilityRouteState.allowed = true;
  });

  describe("loadOperatorView", () => {
    const seeded: Record<string, string> = {};

    beforeAll(() => {
      const d = (offset: number) => addDays(today(), offset);
      seeded.confirmed = seedBooking({
        date: d(2),
        status: "confirmed",
        party: 3,
        payment: { status: "captured", order: "IT6-ORDER-1", capture: "IT6-CAP-1" },
      }).bookingId;
      seeded.attention = seedBooking({
        date: d(3),
        status: "needs_attention",
        payment: { status: "refund_failed", order: "IT6-ORDER-2", capture: "IT6-CAP-2", refund: "IT6-REF-2" },
      }).bookingId;
      seeded.refunding = seedBooking({
        date: d(4),
        status: "refund_pending",
        payment: { status: "refund_pending", order: "IT6-ORDER-3", capture: "IT6-CAP-3", refund: "IT6-REF-3" },
      }).bookingId;
      seeded.cancelling = seedBooking({
        date: d(5),
        status: "cancel_pending",
        payment: { status: "captured", order: "IT6-ORDER-4", capture: "IT6-CAP-4" },
      }).bookingId;
      seeded.recent = seedBooking({
        date: d(-3),
        status: "confirmed",
        payment: { status: "captured", order: "IT6-ORDER-5", capture: "IT6-CAP-5" },
      }).bookingId;
      seeded.tooOld = seedBooking({ date: d(-8), status: "confirmed" }).bookingId;
      seeded.pending = seedBooking({ date: d(6), status: "pending_payment", hold: "live", party: 1 }).bookingId;
      seeded.expiredHold = seedBooking({ date: d(6), status: "pending_payment", hold: "expired" }).bookingId;
      seeded.foreign = seedBooking({
        experience: OTHER_EXPERIENCE,
        date: d(2),
        status: "needs_attention",
        hold: "live",
        payment: { status: "captured", order: "IT6-ORDER-X", capture: "IT6-CAP-X" },
      }).bookingId;
    });

    it("lists only this merchant's bookings from seven days ago onward", async () => {
      const view = await loadOperatorView(localServiceClient(), access);

      const ids = view.bookings.map((booking) => booking.id).sort();
      const expected = [
        seeded.confirmed,
        seeded.attention,
        seeded.refunding,
        seeded.cancelling,
        seeded.recent,
        seeded.pending,
        seeded.expiredHold,
      ].sort();
      expect(ids).toEqual(expected);
      expect(ids).not.toContain(seeded.foreign);
      expect(ids).not.toContain(seeded.tooOld);
      expect(view.merchant).toEqual({ name: "IT Operator Merchant", isFixture: true });
      expect(view.today).toBe(today());
    });

    it("flags needs_attention, refund_pending, refund_failed and cancel_pending as exceptions, with the payment ids", async () => {
      const view = await loadOperatorView(localServiceClient(), access);
      const byId = new Map(view.bookings.map((booking) => [booking.id, booking]));

      expect(byId.get(seeded.attention)?.exception).toBe(true);
      expect(byId.get(seeded.refunding)?.exception).toBe(true);
      expect(byId.get(seeded.cancelling)?.exception).toBe(true);
      expect(byId.get(seeded.confirmed)?.exception).toBe(false);
      expect(byId.get(seeded.pending)?.exception).toBe(false);
      expect(byId.get(seeded.attention)?.payment).toEqual({
        status: "refund_failed",
        orderId: "IT6-ORDER-2",
        captureId: "IT6-CAP-2",
        refundId: "IT6-REF-2",
      });
      expect(byId.get(seeded.confirmed)).toMatchObject({
        experienceTitle: "IT operator walk",
        slotTime: "10:00",
        partySize: 3,
        depositCents: 3000,
        balanceCents: 9000,
        status: "confirmed",
      });
    });

    it("summarizes upcoming bookings, deposits collected, balance due and exceptions", async () => {
      const { summary } = await loadOperatorView(localServiceClient(), access);

      // Upcoming confirmed: only seeded.confirmed (the recent one is in the past).
      // Deposits collected: captured payments of confirmed, cancelling and recent bookings.
      expect(summary).toEqual({ upcoming: 1, depositsCollectedCents: 9000, balanceDueCents: 9000, exceptions: 3 });
    });

    it("lists only this merchant's live holds", async () => {
      const { holds } = await loadOperatorView(localServiceClient(), access);

      const pendingHold = psql(`SELECT hold_id FROM public.bookings WHERE id = '${seeded.pending}';`);
      expect(holds.map((hold) => hold.id)).toEqual([pendingHold]);
      expect(holds[0]).toMatchObject({ experienceTitle: "IT operator walk", slotTime: "10:00", partySize: 1 });
      expect(holds[0].reference).toMatch(/^IT6-/);
    });

    it("shows 14 days of capacity per start time for this merchant's experiences only", async () => {
      const { capacity } = await loadOperatorView(localServiceClient(), access);

      expect(capacity.map((experience) => experience.id)).toEqual([EXPERIENCE]);
      const slots = capacity[0].slots;
      expect(slots).toHaveLength(14);
      expect(slots[0].date).toBe(today());
      expect(capacity[0].capacity).toBe(CAPACITY);
      // Day +2: one confirmed booking of 3. Day +6: one live hold of 1 (the expired hold counts for nothing).
      expect(slots.find((slot) => slot.date === addDays(today(), 2))).toEqual({
        date: addDays(today(), 2),
        startTime: "10:00",
        available: CAPACITY - 3,
      });
      expect(slots.find((slot) => slot.date === addDays(today(), 6))?.available).toBe(CAPACITY - 1);
    });

    it("answers the GET route with the same view, no-store, for a valid capability", async () => {
      const response = await getView(routeRequest("/api/operator/x"), { params: Promise.resolve({ capability: capabilityOf(ACCESS) }) });

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      const body = (await response.json()) as { bookings: { id: string }[] };
      expect(body.bookings.map((booking) => booking.id)).not.toContain(seeded.foreign);
      expect(body.bookings.map((booking) => booking.id)).toContain(seeded.confirmed);
    });
  });

  describe("capability", () => {
    it.each([
      ["a tampered token", () => `${ACCESS}.${"A".repeat(43)}`],
      ["an expired operator link", () => capabilityOf(EXPIRED_ACCESS)],
      ["an unknown id", () => capabilityOf("b0060000-0000-4000-8000-0000000000c9")],
      ["garbage", () => "not-a-capability"],
    ])("404s %s with no data", async (_name, capability) => {
      const response = await getView(routeRequest("/api/operator/x"), { params: Promise.resolve({ capability: capability() }) });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("404s every action behind an expired operator link", async () => {
      const { holdId, bookingId } = seedBooking({ date: addDays(today(), releaseDayOffset++), status: "pending_payment", hold: "live" });

      expect((await release(holdId, capabilityOf(EXPIRED_ACCESS))).status).toBe(404);
      expect((await reissue(bookingId, capabilityOf(EXPIRED_ACCESS))).status).toBe(404);
      expect(holdState(holdId)).toBe("false:false");
      expect(linkVersion(bookingId)).toBe(1);
    });
  });

  describe("releasing a hold", () => {
    it("releases a live hold and frees its places", async () => {
      const date = addDays(today(), releaseDayOffset++);
      const { holdId } = seedBooking({ date, status: "pending_payment", hold: "live", party: 4 });
      expect(available(date)).toBe(CAPACITY - 4);

      const response = await release(holdId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ released: true });
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(holdState(holdId)).toBe("false:true");
      expect(available(date)).toBe(CAPACITY);
    });

    it.each([
      ["expired", "pending_payment"],
      ["consumed", "confirmed"],
      ["released", "pending_payment"],
    ] as const)("answers 409 for a %s hold and changes nothing", async (hold, status) => {
      const date = addDays(today(), releaseDayOffset++);
      const { holdId } = seedBooking({ date, status, hold, party: 2 });
      const before = holdState(holdId);
      const availableBefore = available(date);

      const response = await release(holdId);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "hold_not_live" });
      expect(holdState(holdId)).toBe(before);
      expect(available(date)).toBe(availableBefore);
    });

    it("404s another merchant's hold and leaves it live", async () => {
      const date = addDays(today(), releaseDayOffset++);
      const { holdId } = seedBooking({ experience: OTHER_EXPERIENCE, date, status: "pending_payment", hold: "live", party: 2 });

      expect((await release(holdId)).status).toBe(404);
      expect(holdState(holdId)).toBe("false:false");
      expect(available(date, OTHER_EXPERIENCE)).toBe(CAPACITY - 2);
    });

    it("returns not_found for an id that is not a uuid, without a query error", async () => {
      expect(await releaseOperatorHold(localServiceClient(), MERCHANT, "nope")).toBe("not_found");
    });
  });

  describe("re-issuing a visitor link", () => {
    it("returns a new link once and the old link stops opening the booking", async () => {
      const { bookingId } = seedBooking({ date: addDays(today(), releaseDayOffset++), status: "confirmed" });
      const client = localServiceClient();
      const oldCapability = bookingLink({ id: bookingId, linkVersion: 1 }).slice("/booking/".length);
      expect((await verifyBookingCapability(client, oldCapability))?.id).toBe(bookingId);

      const response = await reissue(bookingId);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      const { link } = (await response.json()) as { link: string };
      expect(link).toBe(bookingLink({ id: bookingId, linkVersion: 2 }));
      expect(await verifyBookingCapability(client, oldCapability)).toBeNull();
      const reopened = await verifyBookingCapability(client, link.slice("/booking/".length));
      expect(reopened).toMatchObject({ id: bookingId, linkVersion: 2 });
    });

    it("increments the version on every re-issue", async () => {
      const { bookingId } = seedBooking({ date: addDays(today(), releaseDayOffset++), status: "confirmed" });

      await reissueBookingLink(localServiceClient(), MERCHANT, bookingId);
      const third = await reissueBookingLink(localServiceClient(), MERCHANT, bookingId);

      expect(third).toBe(bookingLink({ id: bookingId, linkVersion: 3 }));
      expect(linkVersion(bookingId)).toBe(3);
    });

    it("404s another merchant's booking and leaves its link working", async () => {
      const { bookingId } = seedBooking({ experience: OTHER_EXPERIENCE, date: addDays(today(), releaseDayOffset++), status: "confirmed" });

      expect((await reissue(bookingId)).status).toBe(404);
      expect(linkVersion(bookingId)).toBe(1);
    });
  });
});
