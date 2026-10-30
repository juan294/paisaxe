// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { JEV_MODEL } from "../jev/contracts";
import { interpretBookingIntake, tryBookingIntake } from "./intake";
import type { BookingTurnInput } from "./agent";
const now = new Date("2026-10-28T10:00:00Z");
const message =
  "Qué experiencias hay para dos personas el 2026-10-30 hasta 150 euros";
function provider(probability: Record<string, number> = {}) {
  return vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const answers = Object.fromEntries(
      Object.entries(body.questions).map(([key, question]) => [
        key,
        (question as { type: string }).type === "noul"
          ? {
              type: "noul",
              noul:
                probability[key] ??
                ([
                  "discovery",
                  "party_present",
                  "date_present",
                  "budget_present",
                ].includes(key)
                  ? 0.99
                  : 0.01),
            }
          : {
              type: "choice",
              choice: "forged",
              confidence: 1,
              probabilities: { forged: 1 },
            },
      ]),
    );
    return Response.json({
      model: JEV_MODEL,
      answers,
      usage: { input_tokens: 100, output_tokens: 0 },
    });
  });
}
const evaluation = {
  mode: "evaluation" as const,
  task: "booking_intake" as const,
  authorized: true as const,
};
beforeEach(() => {
  vi.stubEnv("TYPESAFE_API_KEY", "fixture-key");
  vi.stubEnv("JEV_ENABLED_TASKS", "booking_intake");
  vi.stubEnv("BOOKING_AGENT_REPLAY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function turn(databaseFetch: typeof fetch): BookingTurnInput {
  return {
    anthropic: {
      messages: {
        stream: () => {
          throw new Error("Claude must not run");
        },
      },
    },
    tools: {
      userId: "11111111-1111-4111-8111-111111111111",
      redemptionId: "r",
      client: createClient("http://127.0.0.1:59999", "fixture-key", {
        auth: { persistSession: false },
        global: { fetch: databaseFetch },
      }),
    },
    message,
    history: [],
    draft: {
      id: "d",
      userId: "u",
      status: "open",
      partySize: null,
      slotDate: null,
      slotTime: null,
      budgetCents: null,
      constraints: {},
    },
    bookings: [],
    acceptedBooking: null,
    contextText: null,
    locale: "es",
    signal: new AbortController().signal,
    now,
  };
}
function database(error = false) {
  return vi.fn<typeof fetch>(async (url, init) => {
    if (error)
      return Response.json(
        { message: "fixture database error" },
        { status: 500 },
      );
    if (!String(url).includes("/rpc/"))
      expect(init?.method ?? "GET").toBe("GET");
    else expect(String(url)).toContain("/rpc/experience_availability");
    if (String(url).includes("booking_drafts"))
      return Response.json({
        id: "d",
        user_id: "u",
        status: "open",
        party_size: null,
        slot_date: null,
        slot_time: null,
        budget_cents: null,
        constraints: {},
      });
    if (String(url).includes("experience_availability"))
      return Response.json([{ start_time: "10:00:00", available: 12 }]);
    return Response.json([
      {
        id: "22222222-2222-4222-8222-222222222222",
        merchant_id: "33333333-3333-4333-8333-333333333333",
        slug: "coast",
        title: "Paseo por la senda costera",
        description: "Camino llano",
        price_cents: 12000,
        deposit_cents: 3000,
        currency: "EUR",
        max_party: 6,
        capacity_per_slot: 12,
        slot_rule: { weekdays: [1, 2, 3, 4, 5, 6, 7], start_times: ["10:00"] },
        experience_facts: [],
      },
    ]);
  });
}
describe("INTAKE semantic interpretation", () => {
  it("INTAKE-01 accepts singleton candidates behind independent semantic gates", async () => {
    const fetch = provider();
    expect(
      await interpretBookingIntake(message, {
        now,
        context: evaluation,
        fetch,
      }),
    ).toMatchObject({
      status: "accepted",
      criteria: {
        partySize: 2,
        date: "2026-10-30",
        budgetCents: 15000,
        constraints: {},
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    "discovery",
    "party_present",
    "date_present",
    "budget_present",
    "contradiction",
    "unsupported_requirement",
    "specific_experience",
    "mixed_intent",
    "style_preference",
    "time_requirement",
    "required_step_free",
  ])(
    "INTAKE-04 abstains on uncertain %s and subsequently recovers",
    async (key) => {
      expect(
        (
          await interpretBookingIntake(message, {
            now,
            context: evaluation,
            fetch: provider({ [key]: 0.5 }),
          })
        ).status,
      ).toBe("fallback");
      expect(
        (
          await interpretBookingIntake(message, {
            now,
            context: evaluation,
            fetch: provider(),
          })
        ).status,
      ).toBe("accepted");
    },
  );
  it("optional budget absence requires an independent negative judgment", async () => {
    const text = "Qué hay para dos personas mañana";
    expect(
      await interpretBookingIntake(text, {
        now,
        context: evaluation,
        fetch: provider({ budget_present: 0.01 }),
      }),
    ).toMatchObject({ status: "accepted", criteria: { date: "2026-10-29" } });
    expect(
      (
        await interpretBookingIntake(text, {
          now,
          context: evaluation,
          fetch: provider(),
        })
      ).status,
    ).toBe("fallback");
  });
  it("INTAKE-08 copies only supported hard spans and rejects missing or uncertain requirements", async () => {
    const text = message + " sin escaleras, con transporte público y con perro";
    expect(
      await interpretBookingIntake(text, {
        now,
        context: evaluation,
        fetch: provider({
          required_step_free: 0.99,
          required_public_transport: 0.99,
          required_pets: 0.99,
        }),
      }),
    ).toMatchObject({
      status: "accepted",
      criteria: {
        constraints: { step_free: true, public_transport: true, pets: true },
      },
    });
    expect(
      (
        await interpretBookingIntake(message, {
          now,
          context: evaluation,
          fetch: provider({ required_pets: 0.99 }),
        })
      ).status,
    ).toBe("fallback");
  });
});
describe("INTAKE buffered real tool/HTTP integration", () => {
  it("uses one Jev call and real read-only search, preserves cards and exact catalog names", async () => {
    const db = database(),
      fetch = provider();
    const result = await tryBookingIntake(turn(db), { fetch });
    expect(result.status).toBe("handled");
    if (result.status !== "handled") throw new Error("expected handled");
    expect(result.events.map((e) => e.type)).toEqual([
      "tool",
      "tool",
      "card",
      "text",
    ]);
    expect(result.events.at(-1)).toMatchObject({
      content: expect.stringContaining("Paseo por la senda costera"),
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["off", "replay", "locale", "history", "draft", "bookings"])(
    "INTAKE-02 skips inference for %s",
    async (reason) => {
      const input = turn(database()),
        fetch = provider();
      if (reason === "off") vi.stubEnv("JEV_ENABLED_TASKS", "");
      if (reason === "replay") vi.stubEnv("BOOKING_AGENT_REPLAY", "e2e");
      if (reason === "locale") input.locale = "fr";
      if (reason === "history")
        input.history = [{ role: "user", content: "Hola" }];
      if (reason === "draft") input.draft.partySize = 2;
      if (reason === "bookings") input.bookings = [{} as never];
      expect((await tryBookingIntake(input, { fetch })).status).toBe(
        "fallback",
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("INTAKE-06 has no partial events on database/provider failure and recovers", async () => {
    expect(
      await tryBookingIntake(turn(database(true)), { fetch: provider() }),
    ).toMatchObject({ status: "fallback" });
    expect(
      await tryBookingIntake(turn(database()), {
        fetch: async () => Response.json({ error: "rate" }, { status: 429 }),
      }),
    ).toMatchObject({ status: "fallback" });
    expect(
      await tryBookingIntake(turn(database()), { fetch: provider() }),
    ).toMatchObject({ status: "handled" });
  });
  it("INTAKE-07 aborts before inference and during legacy search with no stale events", async () => {
    const controller = new AbortController();
    const input = turn(database());
    input.signal = controller.signal;
    controller.abort();
    const fetch = provider();
    expect(await tryBookingIntake(input, { fetch })).toMatchObject({
      status: "aborted",
    });
    expect(fetch).not.toHaveBeenCalled();
    const during = new AbortController();
    const db = database();
    const delayed: typeof globalThis.fetch = async (...args) => {
      during.abort();
      return db(...args);
    };
    const running = turn(delayed);
    running.signal = during.signal;
    expect(
      await tryBookingIntake(running, { fetch: provider() }),
    ).toMatchObject({ status: "aborted" });
  });
});

it("INTAKE-04 resolves repeated compatible spans only through valid confident Choice IDs", async () => {
  const duplicate =
    "Qué experiencias hay para dos personas, somos dos, el 2026-10-30 y 2026-10-30 hasta 150 euros y hasta 150 euros";
  const answer =
    (top: number): typeof globalThis.fetch =>
    async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      const fixture = await provider()(
        "https://api.typesafe.ai/v1/systemone",
        init,
      );
      const value = await fixture.json();
      for (const [id, question] of Object.entries(request.questions)) {
        const q = question as {
          type: string;
          criteria: Record<string, unknown>;
        };
        if (q.type === "choice") {
          const keys = Object.keys(q.criteria);
          value.answers[id] = {
            type: "choice",
            choice: keys[1],
            confidence: top,
            probabilities: { [keys[0]!]: 1 - top, [keys[1]!]: top },
          };
        }
      }
      return Response.json(value);
    };
  expect(
    await interpretBookingIntake(duplicate, {
      now,
      context: evaluation,
      fetch: answer(0.99),
    }),
  ).toMatchObject({
    status: "accepted",
    criteria: { partySize: 2, date: "2026-10-30", budgetCents: 15000 },
  });
  expect(
    await interpretBookingIntake(duplicate, {
      now,
      context: evaluation,
      fetch: answer(0.6),
    }),
  ).toMatchObject({ status: "fallback" });
  expect(
    await interpretBookingIntake(duplicate, {
      now,
      context: evaluation,
      fetch: provider(),
    }),
  ).toMatchObject({ status: "fallback" });
});
it("INTAKE-07 abort during inference starts no database search", async () => {
  const controller = new AbortController(),
    db = database(),
    input = turn(db);
  input.signal = controller.signal;
  const fetch: typeof globalThis.fetch = async (_url, init) => {
    controller.abort();
    return provider()("https://api.typesafe.ai/v1/systemone", init);
  };
  expect(await tryBookingIntake(input, { fetch })).toMatchObject({
    status: "aborted",
  });
  expect(db).not.toHaveBeenCalled();
});
it("INTAKE-08 keeps rejected/unknown reasons and distinct empty guidance", async () => {
  const rejected = turn(database());
  rejected.message = message.replace("150 euros", "40 euros");
  const all = await tryBookingIntake(rejected, { fetch: provider() });
  expect(all.status).toBe("handled");
  if (all.status !== "handled") throw new Error("expected handled");
  expect(all.events.at(-1)).toMatchObject({
    content: expect.stringContaining("descartadas"),
  });
  expect(all.events).toContainEqual(
    expect.objectContaining({
      type: "card",
      card: expect.objectContaining({
        options: [
          expect.objectContaining({
            suitability: "rejected",
            reasons: ["over_budget"],
          }),
        ],
      }),
    }),
  );
  const base = database();
  const empty: typeof globalThis.fetch = async (url, init) =>
    String(url).includes("/experiences?") ? Response.json([]) : base(url, init);
  const none = await tryBookingIntake(turn(empty), { fetch: provider() });
  expect(none.status).toBe("handled");
  if (none.status !== "handled") throw new Error("expected handled");
  expect(none.events.at(-1)).toMatchObject({
    content: expect.stringContaining("No hay opciones"),
  });
  const unknown = turn(database());
  unknown.message += " con perro";
  const result = await tryBookingIntake(unknown, {
    fetch: provider({ required_pets: 0.99 }),
  });
  expect(result.status).toBe("handled");
  if (result.status !== "handled") throw new Error("expected handled");
  expect(result.events).toContainEqual(
    expect.objectContaining({
      type: "card",
      card: expect.objectContaining({
        options: [
          expect.objectContaining({
            suitability: "unconfirmed",
            verdicts: [
              expect.objectContaining({ key: "pets", verdict: "unknown" }),
            ],
          }),
        ],
      }),
    }),
  );
});
it("INTAKE-02 every existing semantic draft field blocks the fast path", async () => {
  for (const patch of [
    { slotDate: "2026-10-30" },
    { slotTime: "10:00" },
    { budgetCents: 1 },
    { constraints: { pets: true } },
    { status: "accepted" as const },
  ]) {
    const input = turn(database());
    Object.assign(input.draft, patch);
    const fetch = provider();
    expect(await tryBookingIntake(input, { fetch })).toMatchObject({
      status: "fallback",
    });
    expect(fetch).not.toHaveBeenCalled();
  }
  const accepted = turn(database());
  accepted.acceptedBooking = { id: "b", reference: "B" };
  const fetch = provider();
  expect(await tryBookingIntake(accepted, { fetch })).toMatchObject({
    status: "fallback",
  });
  expect(fetch).not.toHaveBeenCalled();
});
it("INTAKE agent handles once with zero Claude transport and abort fences every buffered emission", async () => {
  const [{ streamBookingTurn }, { default: Anthropic }] = await Promise.all([
    import("./agent"),
    import("@anthropic-ai/sdk"),
  ]);
  const claude = vi.fn<typeof globalThis.fetch>(async () => {
    throw new Error("Unexpected Claude request");
  });
  vi.stubGlobal("fetch", provider());
  const input = turn(database());
  input.anthropic = new Anthropic({ apiKey: "fixture-key", fetch: claude });
  const events = [];
  for await (const event of streamBookingTurn(input)) events.push(event);
  expect(events.map((e) => e.type)).toEqual(["tool", "tool", "card", "text"]);
  expect(claude).not.toHaveBeenCalled();
  const controller = new AbortController();
  const cancelled = turn(database());
  cancelled.signal = controller.signal;
  cancelled.anthropic = input.anthropic;
  const iterator = streamBookingTurn(cancelled);
  expect((await iterator.next()).value).toMatchObject({
    type: "tool",
    status: "start",
  });
  controller.abort();
  expect((await iterator.next()).done).toBe(true);
  vi.unstubAllGlobals();
});

it('English fast path emits English guidance and display names with canonical facts unchanged',async()=>{
 const input=turn(database());input.locale='en';input.message='What experiences are available for two people tomorrow up to 150 euros?';
 const result=await tryBookingIntake(input,{fetch:provider()});expect(result.status).toBe('handled');if(result.status!=='handled')throw Error('Expected English intake');
 expect(result.events.find(e=>e.type==='text')).toMatchObject({content:expect.stringContaining('Coastal path walk')});
 expect(result.events.find(e=>e.type==='text')).toMatchObject({content:expect.stringContaining('This search has not created a booking')});
 expect(result.events.find(e=>e.type==='card')).toMatchObject({card:{kind:'offer',options:[{title:'Paseo por la senda costera',priceCents:12000}]}});
});
