// @vitest-environment node
/**
 * Booking tools against the live local stack and the fixture merchant
 * (migration 116): constraint verdicts (F07), ownership, and that no
 * tool_result carries a capability link or URL (F05).
 *
 * Requires `supabase start`; self-skips otherwise.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  isLocalSupabaseReachable,
  localServiceClient,
  psql,
  sqlList,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";
import { addDays, madridDate } from "./types";
import { FIXTURE_EXPERIENCE_SLUGS } from "./fixtures";
import { executeBookingTool } from "./tools";

const dbReachable = await isLocalSupabaseReachable();
if (!dbReachable) warnLocalSupabaseUnreachable("tools.postgrest-integration.test.ts");

const USER_A = "b0030000-0000-4000-8000-0000000000a1";
const USER_B = "b0030000-0000-4000-8000-0000000000b1";
const USERS = [USER_A, USER_B];

function cleanup(): void {
  const users = sqlList(USERS);
  psql(
    `DELETE FROM public.payments WHERE booking_id IN (SELECT id FROM public.bookings WHERE user_id IN (${users}));` +
      `DELETE FROM public.bookings WHERE user_id IN (${users});` +
      `DELETE FROM public.holds WHERE quote_id IN (SELECT id FROM public.quotes WHERE user_id IN (${users}));` +
      `DELETE FROM public.quotes WHERE user_id IN (${users});` +
      `DELETE FROM public.booking_drafts WHERE user_id IN (${users});` +
      `DELETE FROM public.user_profiles WHERE user_id IN (${users});` +
      `DELETE FROM auth.users WHERE id IN (${users});`
  );
}

function expectNoLinks(result: unknown) {
  const text = JSON.stringify(result);
  expect(text).not.toMatch(/\/booking\//);
  expect(text).not.toMatch(/https?:\/\//);
}

describe.skipIf(!dbReachable)("booking tools against the fixture merchant", () => {
  const ctxA = () => ({ userId: USER_A, redemptionId: "r-a", client: localServiceClient() });
  const ctxB = () => ({ userId: USER_B, redemptionId: "r-b", client: localServiceClient() });
  const date = addDays(madridDate(new Date()), 20);

  beforeAll(() => {
    vi.stubEnv("BOOKING_LINK_SECRET", "integration-test-secret-that-is-at-least-32-bytes");
    cleanup();
    for (const id of USERS) {
      psql(`INSERT INTO auth.users (id, email) VALUES ('${id}', '${id}@tools-it.test') ON CONFLICT (id) DO NOTHING;`);
    }
  });

  afterAll(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("step_free required: canoe unsupported with the provider's detail, 4x4 unknown and unconfirmed, coastal walk supported (F07)", async () => {
    const outcome = await executeBookingTool(ctxA(), "search_experiences", {
      partySize: 4,
      date,
      budgetCents: 12000,
      constraints: { step_free: true },
    });
    expect(outcome.isError).toBe(false);
    const options = (outcome.result as { options: { title: string; suitability: string; verdicts: { key: string; verdict: string; detail: string | null; confirmedByProvider: boolean }[] }[] }).options;
    const byTitle = (needle: string) => {
      const option = options.find((o) => o.title.toLowerCase().includes(needle));
      if (!option) throw new Error(`no option matching ${needle}`);
      return option;
    };
    const stepFree = (needle: string) => byTitle(needle).verdicts.find((v) => v.key === "step_free");

    expect(stepFree("canoa")).toMatchObject({ verdict: "unsupported", detail: "El embarcadero tiene escalones", confirmedByProvider: true });
    expect(stepFree("4x4")).toMatchObject({ verdict: "unknown", confirmedByProvider: false });
    expect(stepFree("senda costera")).toMatchObject({ verdict: "supported", confirmedByProvider: true });
    expect(byTitle("canoa").suitability).toBe("rejected");
    expect(byTitle("senda costera").suitability).toBe("suitable");
    expectNoLinks(outcome.result);
    expect(outcome.card?.kind).toBe("offer");
  });

  it("draft -> quote -> booking status: ids in results, the link only in the card, foreign bookings refused", async () => {
    expect((await executeBookingTool(ctxA(), "update_booking_draft", { partySize: 4, date })).isError).toBe(false);

    const experienceId = psql(`SELECT id FROM public.experiences WHERE slug = '${FIXTURE_EXPERIENCE_SLUGS.coastalWalk}';`);
    const quote = await executeBookingTool(ctxA(), "get_quote", { experienceId, date, time: "10:00", partySize: 4 });
    expect(quote.isError).toBe(false);
    expect(quote.result).toMatchObject({ totalEuros: "120.00", depositEuros: "30.00", balanceEuros: "90.00" });
    expectNoLinks(quote.result);

    const quoteId = (quote.result as { quoteId: string }).quoteId;
    const bookingId = psql(
      `SELECT (public.accept_quote('${quoteId}'::uuid, '${USER_A}'::uuid)).id;`
    );

    const status = await executeBookingTool(ctxA(), "get_booking_status", { bookingId });
    expect(status.isError).toBe(false);
    expectNoLinks(status.result);
    expect(status.card).toMatchObject({ kind: "booking", bookingId });
    expect((status.card as { link: string }).link).toMatch(new RegExp(`^/booking/${bookingId}\\.`));

    const foreign = await executeBookingTool(ctxB(), "get_booking_status", { bookingId });
    expect(foreign).toMatchObject({ isError: true, result: { error: "not_found" } });
    const foreignList = await executeBookingTool(ctxB(), "get_booking_status", {});
    expect(foreignList.result).toEqual({ bookings: [] });
  });
});
