// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

vi.mock("@/lib/costs/anthropic-usage", () => ({ recordAnthropicUsageInBackground: vi.fn() }));
vi.mock("./tools", () => ({
  executeBookingTool: vi.fn(),
  bookingToolDefinitions: vi.fn(() => []),
}));

const { executeBookingTool } = await import("./tools");
const { createBookingModelClient, streamBookingTurn } = await import("./agent");
const { assertReplayAllowed, createReplayModelClient, parseReplayFixture, replayModelClient, replayResponse } =
  await import("./replay-model");

const fixture = parseReplayFixture(
  JSON.parse(readFileSync(join(process.cwd(), "e2e/fixtures/booking-agent-replay/e2e.json"), "utf8"))
);
const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const system: Anthropic.TextBlockParam[] = [
  { type: "text", text: "persona" },
  {
    type: "text",
    text:
      "\n\n# ESTADO DE LA RESERVA (datos del servidor)\n" +
      `Reservas del visitante: ${JSON.stringify([
        { bookingId: OTHER_ID, status: "cancelled" },
        { bookingId: BOOKING_ID, status: "confirmed" },
      ])}\n` +
      `El visitante acaba de pulsar el botón y ha aceptado la oferta: reserva RS-1 (bookingId ${BOOKING_ID}), plaza retenida 15 minutos.`,
  },
];

function params(messages: Anthropic.MessageParam[]): Anthropic.MessageStreamParams {
  return { model: "claude-test", max_tokens: 10, system, messages };
}

function toolResult(content: unknown): Anthropic.MessageParam {
  return { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: JSON.stringify(content) }] };
}

function assistantToolUse(): Anthropic.MessageParam {
  return { role: "assistant", content: [{ type: "tool_use", id: "t", name: "x", input: {} }] };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertReplayAllowed (the production guard)", () => {
  it.each([
    [{ nodeEnv: "production" }],
    [{ nodeEnv: "development", vercel: "1" }],
    [{ nodeEnv: "development", vercelEnv: "preview" }],
    [{ nodeEnv: "development", vercelEnv: "production" }],
  ])("refuses %o", (env) => {
    expect(() => assertReplayAllowed(env)).toThrow(/only in local tests/);
  });

  it.each([[{ nodeEnv: "development" }], [{ nodeEnv: "test" }]])("allows a local process %o", (env) => {
    expect(() => assertReplayAllowed(env)).not.toThrow();
  });

  it("is enforced by the entry point before any fixture is read", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => createReplayModelClient("e2e")).toThrow(/only in local tests/);
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => createReplayModelClient("e2e")).toThrow(/only in local tests/);
  });

  it("makes the booking agent refuse to build a model client on Vercel", async () => {
    vi.stubEnv("BOOKING_AGENT_REPLAY", "e2e");
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(createBookingModelClient()).rejects.toThrow(/only in local tests/);
  });

  it("serves the replay locally instead of the Anthropic SDK", async () => {
    vi.stubEnv("BOOKING_AGENT_REPLAY", "e2e");
    const client = await createBookingModelClient();
    const final = await client.messages
      .stream(params([{ role: "user", content: `Estado de la reserva ${OTHER_ID}` }]))
      .finalMessage();
    expect(final.content[0]).toMatchObject({ type: "tool_use", name: "get_booking_status", input: { bookingId: OTHER_ID } });
  });

  it("only accepts a fixture name, never a path", () => {
    expect(() => createReplayModelClient("../../.env")).toThrow(/fixture name/);
  });
});

describe("replayResponse with the committed e2e fixture", () => {
  it("searches, then quotes the experience the search returned, then answers", () => {
    const visitor: Anthropic.MessageParam = { role: "user", content: "Somos 2 personas el 2026-11-20 a las 10:00" };

    const search = replayResponse(fixture, params([visitor]), 1);
    expect(search.stop_reason).toBe("tool_use");
    expect(search.content).toMatchObject([{ name: "search_experiences", input: { partySize: 2, date: "2026-11-20" } }]);

    const options = { options: [{ title: "Descenso en canoa", experienceId: "canoe" }, { title: "Paseo por la senda costera", experienceId: "walk" }] };
    const quote = replayResponse(fixture, params([visitor, assistantToolUse(), toolResult(options)]), 2);
    expect(quote.content).toMatchObject([
      { name: "get_quote", input: { experienceId: "walk", date: "2026-11-20", time: "10:00", partySize: 2 } },
    ]);

    const text = replayResponse(fixture, params([visitor, assistantToolUse(), toolResult(options), assistantToolUse(), toolResult({})]), 3);
    expect(text.stop_reason).toBe("end_turn");
    expect(text.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("Aceptar oferta") });
  });

  it("reads the accepted booking and the confirmed booking from the server's state block", () => {
    const accepted = replayResponse(fixture, params([{ role: "user", content: "He aceptado la oferta." }]), 1);
    expect(accepted.content).toMatchObject([{ name: "create_payment_order", input: { bookingId: BOOKING_ID } }]);

    const cancel = replayResponse(fixture, params([{ role: "user", content: "Quiero cancelar mi reserva" }]), 1);
    expect(cancel.content).toMatchObject([{ name: "preview_cancellation", input: { bookingId: BOOKING_ID } }]);
  });

  it("matches the latest paragraph when history merged into the visitor's message", () => {
    const merged = replayResponse(fixture, params([{ role: "user", content: `hola\n\nEstado de la reserva ${OTHER_ID}` }]), 1);
    expect(merged.content).toMatchObject([{ name: "get_booking_status", input: { bookingId: OTHER_ID } }]);
  });

  it("echoes the tool's error code, or none", () => {
    const visitor: Anthropic.MessageParam = { role: "user", content: `Estado de la reserva ${OTHER_ID}` };
    const refused = replayResponse(fixture, params([visitor, assistantToolUse(), toolResult({ error: "not_found" })]), 2);
    expect(refused.content[0]).toMatchObject({ text: "Resultado: not_found" });
    const served = replayResponse(fixture, params([visitor, assistantToolUse(), toolResult({ bookings: [] })]), 2);
    expect(served.content[0]).toMatchObject({ text: "Resultado: none" });
  });

  it("fails loudly on a message no scenario covers, a missing step, or a missing tool input", () => {
    expect(() => replayResponse(fixture, params([{ role: "user", content: "hola" }]), 1)).toThrow(/no scenario/);

    const visitor: Anthropic.MessageParam = { role: "user", content: `Estado de la reserva ${OTHER_ID}` };
    const tooFar = [visitor, assistantToolUse(), toolResult({}), assistantToolUse(), toolResult({})];
    expect(() => replayResponse(fixture, params(tooFar), 3)).toThrow(/has no step 2/);

    const noOptions = [{ role: "user", content: "Somos 2 personas el 2026-11-20 a las 10:00" } as Anthropic.MessageParam, assistantToolUse(), toolResult({ options: [] })];
    expect(() => replayResponse(fixture, params(noOptions), 2)).toThrow(/nothing at \{\{result\.options/);
  });
});

describe("parseReplayFixture", () => {
  it.each([
    [{}],
    [{ scenarios: [] }],
    [{ scenarios: [{ name: "x", when: "(", steps: [] }] }],
    [{ scenarios: [{ name: "x", when: "a", steps: [{}] }] }],
    [{ scenarios: [{ name: "x", when: "a", steps: [{ text: "t", tools: [] }] }] }],
  ])("rejects %j", (raw) => {
    expect(() => parseReplayFixture(raw)).toThrow();
  });
});

describe("the replay drives the real tool loop", () => {
  it("runs the recorded tools through executeBookingTool and streams their events", async () => {
    vi.mocked(executeBookingTool).mockResolvedValue({ isError: true, result: { error: "not_found" } });

    const events = [];
    for await (const event of streamBookingTurn({
      anthropic: replayModelClient(fixture),
      tools: { userId: "u", redemptionId: "r", client: {} as never },
      message: `Estado de la reserva ${OTHER_ID}`,
      history: [],
      draft: { id: "d", userId: "u", status: "open", partySize: null, slotDate: null, slotTime: null, budgetCents: null, constraints: {} },
      bookings: [],
      contextText: null,
      acceptedBooking: null,
      signal: new AbortController().signal,
    })) {
      events.push(event);
    }

    expect(executeBookingTool).toHaveBeenCalledWith(expect.anything(), "get_booking_status", { bookingId: OTHER_ID });
    expect(events).toEqual([
      { type: "tool", name: "get_booking_status", status: "start" },
      { type: "tool", name: "get_booking_status", status: "error" },
      { type: "text", content: "Resultado: not_found" },
    ]);
  });
});
