// @vitest-environment node
/**
 * Booking tools against the live local stack and the fixture merchant
 * (migration 116): constraint verdicts (F07), ownership, and that no
 * tool_result carries a capability link or URL (F05).
 *
 * Requires `supabase start`; self-skips otherwise.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
// Live local Supabase: a loaded host can push a test past the 5 s default (#997).
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });
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
import { streamBookingTurn } from "./agent";
import { getOrCreateOpenDraft } from "./drafts";
import { parseReplayFixture, replayModelClient } from "./replay-model";
import type { ChatStreamEvent } from "@/types/sse";

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

  async function modelTurn(steps: unknown[], locale: string, options: { stopReason?: "refusal" | "max_tokens"; events?: ChatStreamEvent[]; controller?: AbortController } = {}) {
    const { stopReason, events = [], controller } = options;
    const tools = { ...ctxB(), locale };
    const anthropic = replayModelClient(parseReplayFixture({ scenarios: [{ name: "untrusted-provider", when: ".*", steps }] }));
    const original = anthropic.messages.stream.bind(anthropic.messages);
    const stream = vi.spyOn(anthropic.messages, "stream");
    if (stopReason) stream.mockImplementation((params, options) => {
      const upstream = original(params, options);
      return {
        [Symbol.asyncIterator]: () => upstream[Symbol.asyncIterator](),
        async finalMessage() {
          const message = await upstream.finalMessage();
          return message.stop_reason === "end_turn" ? { ...message, stop_reason: stopReason } : message;
        },
      };
    });
    for await (const event of streamBookingTurn({
      anthropic, tools, message: "Please help with this experience.",
      history: [{ role: "user", content: "Hello" }, { role: "assistant", content: "How can I help?" }],
      draft: await getOrCreateOpenDraft(tools.client, USER_B), bookings: [], contextText: null,
      acceptedBooking: null, locale, signal: controller?.signal ?? AbortSignal.timeout(15000),
    })) {
      events.push(event);
      if (event.type === "card" && event.card.kind === "quote") controller?.abort();
    }
    return { events, stream, text: events.flatMap(e => e.type === "text" ? [e.content] : []).join("") };
  }

  const search = () => ({ tools: [{ name: "search_experiences", input: { partySize: 2, date, constraints: {} } }] });
  const quote = () => ({ tools: [{ name: "get_quote", input: {
    experienceId: psql(`SELECT id FROM public.experiences WHERE slug = '${FIXTURE_EXPERIENCE_SLUGS.coastalWalk}';`),
    date, time: "16:00", partySize: 2,
  } }] });

  it("keeps untrusted English eligibility prose out of a successful search reply", async () => {
    const result = await modelTurn([search(), { text: "The minimum age requirement is met. The provider has confirmed nothing." }], "en");
    expect(result.events.some(e => e.type === "card" && e.card.kind === "offer")).toBe(true);
    expect(result.text).toContain("Catalogue options:");
    expect(result.text).not.toMatch(/minimum age|confirmed nothing/);
  });

  it("answers an English quote from its real card without another model call", async () => {
    const result = await modelTurn([quote()], "en");
    expect(result.stream).toHaveBeenCalledTimes(1);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "card", card: expect.objectContaining({ kind: "quote", totalCents: 12000, depositCents: 3000 }) }));
    expect(result.text).toBe("I have prepared the Coastal path walk offer. Review the card and select Accept offer.");
  });

  it("owns a successful final quote even after an earlier tool in the batch failed", async () => {
    const result = await modelTurn([{ tools: [{ name: "get_quote", input: { partySize: 0 } }, ...quote().tools] }], "en");
    expect(result.events).toContainEqual({ type: "tool", name: "get_quote", status: "error" });
    expect(result.stream).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("I have prepared the Coastal path walk offer. Review the card and select Accept offer.");
  });

  it("does not emit quote guidance after the visitor aborts on its card", async () => {
    const result = await modelTurn([quote()], "en", { controller: new AbortController() });
    expect(result.events.some(e => e.type === "card" && e.card.kind === "quote")).toBe(true);
    expect(result.stream).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("");
  });

  it("preserves the Spanish model response and tool loop", async () => {
    const result = await modelTurn([quote(), { text: "Revisa la oferta del modelo." }], "es");
    expect(result.stream).toHaveBeenCalledTimes(2);
    expect(result.text).toBe("Revisa la oferta del modelo.");
  });

  it("preserves an English clarification when no card was produced", async () => {
    const result = await modelTurn([{ text: "How old is the youngest participant?" }], "en");
    expect(result.events.some(e => e.type === "card")).toBe(false);
    expect(result.text).toBe("How old is the youngest participant?");
  });

  it("preserves English error recovery after a successful search and invalid tool input", async () => {
    const result = await modelTurn([search(), { tools: [{ name: "get_quote", input: { partySize: 0 } }] }, { text: "Please confirm how many people will attend." }], "en");
    expect(result.events).toContainEqual({ type: "tool", name: "get_quote", status: "error" });
    expect(result.text).toBe("Please confirm how many people will attend.");
  });

  it("does not present an old offer as current after draft criteria change", async () => {
    const result = await modelTurn([search(), { tools: [{ name: "update_booking_draft", input: { partySize: 3 } }] }, { text: "The old options meet every new requirement." }], "en");
    expect(result.text).toContain("Refresh");
    expect(result.text).not.toContain("meet every");
  });

  it("fails closed without publishing a pending-offer refusal", async () => {
    const events: ChatStreamEvent[] = [];
    await expect(modelTurn([search(), { text: "The minimum age requirement is met." }], "en", { stopReason: "refusal", events })).rejects.toThrow("refusal");
    expect(events.filter(e => e.type === "text")).toEqual([]);
  });

  it("uses the verified offer when the model's narrative is truncated", async () => {
    const result = await modelTurn([search(), { text: "The minimum age requirement is met" }], "en", { stopReason: "max_tokens" });
    expect(result.text).toContain("Catalogue options:");
    expect(result.text).not.toContain("minimum age");
  });
});
