import { requiredValue } from "@/test/required-value";
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_CACHE_BREAKPOINTS, countCacheBreakpoints } from "@/test/prompt-cache";

vi.mock("@/lib/costs/anthropic-usage", () => ({ recordAnthropicUsageInBackground: vi.fn() }));
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));
vi.mock("./tools", () => ({
  executeBookingTool: vi.fn(),
  bookingToolDefinitions: vi.fn(() => [{ name: "search_experiences", description: "d", input_schema: { type: "object" } }]),
}));

const { recordAnthropicUsageInBackground } = await import("@/lib/costs/anthropic-usage");
const { executeBookingTool } = await import("./tools");
const { MAX_TOOL_ITERATIONS, ITERATION_CAP_MESSAGE, streamBookingTurn } = await import("./agent");

type StreamEvent = { type: string; delta?: { type: string; text?: string } };
interface FakeTurn {
  texts?: string[];
  content: unknown[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal";
  failBeforeEvents?: Error;
  failAfterText?: Error;
}

function fakeAnthropic(turns: FakeTurn[]) {
  const calls: { params: Record<string, unknown>; options: { signal?: AbortSignal } }[] = [];
  const stream = vi.fn((params: Record<string, unknown>, options: { signal?: AbortSignal }) => {
    calls.push({ params: structuredClone(params), options });
    const turn = turns.shift();
    if (!turn) throw new Error("no more fake turns");
    return {
      async *[Symbol.asyncIterator](): AsyncGenerator<StreamEvent> {
        if (turn.failBeforeEvents) throw turn.failBeforeEvents;
        for (const text of turn.texts ?? []) {
          yield { type: "content_block_delta", delta: { type: "text_delta", text } };
        }
        if (turn.failAfterText) throw turn.failAfterText;
      },
      finalMessage: async () => ({
        content: turn.content,
        stop_reason: turn.stopReason,
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    };
  });
  return { client: { messages: { stream } }, stream, calls };
}

const draft = {
  id: "draft-1",
  userId: "user-1",
  status: "open" as const,
  partySize: 4,
  slotDate: "2026-11-21",
  slotTime: null,
  budgetCents: 12000,
  constraints: { step_free: true },
};

function input(client: unknown, overrides: Record<string, unknown> = {}) {
  return {
    anthropic: client as never,
    tools: { userId: "user-1", redemptionId: "r1", client: {} as SupabaseClient },
    message: "Somos cuatro y queremos algo sin escalones",
    history: [],
    draft,
    bookings: [],
    contextText: null,
    acceptedBooking: null,
    locale: null,
    signal: new AbortController().signal,
    now: new Date("2026-11-20T09:00:00Z"),
    ...overrides,
  };
}

async function collect(generator: AsyncGenerator<unknown>) {
  const events: unknown[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

const toolUse = (id: string) => ({ type: "tool_use", id, name: "search_experiences", input: { date: "2026-11-21" } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(executeBookingTool).mockResolvedValue({
    isError: false,
    result: { options: [] },
    card: { kind: "offer", options: [] },
  });
});

describe("streamBookingTurn", () => {
  it.each([
    "Seremos aproximadamente tres personas; ¿qué hay mañana?",
    "¿Qué hay para tres o cuatro personas mañana?",
    "Seremos aproximadamente tres personas; ¿qué hay mañana a las 16:00?",
    "¿Qué hay para tres o cuatro personas mañana a las 16:00?",
    "Seremos aproximadamente tres personas; ¿qué hay mañana y cómo se paga?",
    "¿Qué hay para tres o cuatro personas mañana y cómo se paga?",
    "Seremos aproximadamente tres personas; ¿qué hay mañana y cuál es la política de cancelación?",
  ])("asks for an exact party before any model, intake or tool: %s", async (message) => {
    const fake = fakeAnthropic([
      { content: [{ type: "tool_use", id: "premature-party", name: "update_booking_draft", input: { partySize: 3 } }, toolUse("premature-search")], stopReason: "tool_use" },
      { texts: ["Para tres personas hay opciones."], content: [], stopReason: "end_turn" },
    ]);
    const intake = vi.fn().mockResolvedValue({ status: "fallback", reason: "baseline" });
    const events = await collect(streamBookingTurn(input(fake.client, { message, locale: "es" }), { intake }));
    expect(events).toEqual([{ type: "text", content: "¿Cuántas personas seréis exactamente?" }]);
    expect(fake.stream).not.toHaveBeenCalled();
    expect(intake).not.toHaveBeenCalled();
    expect(executeBookingTool).not.toHaveBeenCalled();
  });

  it.each(["Quiero cancelar la reserva para aproximadamente tres personas.", "Quiero pagar la reserva para unas tres personas."])("does not interrupt booking management with a party question: %s", async (message) => {
    const fake = fakeAnthropic([{ texts: ["Revisemos tu reserva."], content: [], stopReason: "end_turn" }]);
    expect(await collect(streamBookingTurn(input(fake.client, { message, bookings: [{ id: "existing", reference: "RS-EXISTING", status: "pending_payment", slotDate: "2026-11-21", slotTime: "10:00", partySize: 3 }] })))).toEqual([{ type: "text", content: "Revisemos tu reserva." }]);
    expect(fake.stream).toHaveBeenCalledTimes(1);
  });

  it("continues normally after the visitor supplies the exact party", async () => {
    const fake = fakeAnthropic([{ content: [toolUse("exact-party")], stopReason: "tool_use" }, { texts: ["Hay opciones."], content: [], stopReason: "end_turn" }]);
    const events = await collect(streamBookingTurn(input(fake.client, {
      message: "Seremos exactamente tres personas; busca opciones para el 2026-11-02.",
      history: [{ role: "user", content: "Seremos aproximadamente tres personas; ¿qué hay mañana?" }, { role: "assistant", content: "¿Cuántas personas seréis exactamente?" }],
    })));
    expect(events).toContainEqual({ type: "card", card: { kind: "offer", options: [] } });
    expect(executeBookingTool).toHaveBeenCalledTimes(1);
  });

  it("does not mistake an approximate duration for an uncertain party", async () => {
    const fake = fakeAnthropic([{ texts: ["Hay opciones."], content: [], stopReason: "end_turn" }]);
    expect(await collect(streamBookingTurn(input(fake.client, { message: "Somos tres personas, aproximadamente dos horas; ¿qué hay mañana?" })))).toEqual([{ type: "text", content: "Hay opciones." }]);
    expect(fake.stream).toHaveBeenCalledTimes(1);
  });
  it("runs the tool, emits its status and card, continues with the tool result, and shows only the answer", async () => {
    const fake = fakeAnthropic([
      { texts: ["Miro "], content: [{ type: "text", text: "Miro " }, toolUse("tu_1")], stopReason: "tool_use" },
      { texts: ["Hay ", "opciones."], content: [{ type: "text", text: "Hay opciones." }], stopReason: "end_turn" },
    ]);

    const events = await collect(streamBookingTurn(input(fake.client)));

    expect(events).toEqual([
      { type: "tool", name: "search_experiences", status: "start" },
      { type: "tool", name: "search_experiences", status: "done" },
      { type: "card", card: { kind: "offer", options: [] } },
      { type: "text", content: "Hay opciones." },
    ]);
    expect(executeBookingTool).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      "search_experiences",
      { date: "2026-11-21" }
    );

    const second = requiredValue(fake.calls[1], "src/lib/booking/agent.test.ts:118 fake.calls[1]").params.messages as { role: string; content: unknown }[];
    expect(second.at(-2)).toEqual({ role: "assistant", content: [{ type: "text", text: "Miro " }, toolUse("tu_1")] });
    expect(second.at(-1)).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "tu_1", content: JSON.stringify({ options: [] }), is_error: false }],
    });
    expect(recordAnthropicUsageInBackground).toHaveBeenCalledTimes(2);
    expect(recordAnthropicUsageInBackground).toHaveBeenCalledWith(expect.objectContaining({ source: "booking_chat" }));
  });

  it("reports a failed tool as status error and an is_error tool_result, and the turn continues", async () => {
    vi.mocked(executeBookingTool).mockResolvedValue({ isError: true, result: { error: "no_capacity" } });
    const fake = fakeAnthropic([
      { content: [toolUse("tu_1")], stopReason: "tool_use" },
      { texts: ["No he podido mirarlo ahora."], content: [], stopReason: "end_turn" },
    ]);

    const events = await collect(streamBookingTurn(input(fake.client)));

    expect(events).toContainEqual({ type: "tool", name: "search_experiences", status: "error" });
    expect(events.at(-1)).toEqual({ type: "text", content: "No he podido mirarlo ahora." });
    const toolResult = (requiredValue(fake.calls[1], "src/lib/booking/agent.test.ts:139 fake.calls[1]").params.messages as { content: { is_error: boolean }[] }[]).at(-1)?.content[0];
    expect(toolResult?.is_error).toBe(true);
  });

  it("stops the batch and model turn after a timeout instead of starting dependent tools", async () => {
    vi.mocked(executeBookingTool).mockResolvedValue({ isError: true, result: { error: "timeout" } });
    const fake = fakeAnthropic([{ content: [toolUse("tu_1"), { type: "tool_use", id: "tu_2", name: "get_quote", input: {} }], stopReason: "tool_use" }]);
    const events = await collect(streamBookingTurn(input(fake.client)));
    expect(executeBookingTool).toHaveBeenCalledTimes(1);
    expect(fake.calls).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: "text", content: "La operación ha tardado demasiado y su resultado aún no está confirmado. Consulta el estado de tu reserva antes de repetirla." });
  });

  it("runs several tool calls of one response sequentially, in order", async () => {
    const order: string[] = [];
    vi.mocked(executeBookingTool).mockImplementation(async (_ctx, name) => {
      order.push(`start:${name}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`end:${name}`);
      return { isError: false, result: {} };
    });
    const fake = fakeAnthropic([
      {
        content: [toolUse("tu_1"), { type: "tool_use", id: "tu_2", name: "get_quote", input: {} }],
        stopReason: "tool_use",
      },
      { content: [], stopReason: "end_turn" },
    ]);

    await collect(streamBookingTurn(input(fake.client)));

    expect(order).toEqual(["start:search_experiences", "end:search_experiences", "start:get_quote", "end:get_quote"]);
  });

  it(`stops after ${6} model iterations with the fallback sentence`, async () => {
    const fake = fakeAnthropic(
      Array.from({ length: 10 }, (_, i) => ({ content: [toolUse(`tu_${i}`)], stopReason: "tool_use" as const }))
    );

    const events = await collect(streamBookingTurn(input(fake.client)));

    expect(MAX_TOOL_ITERATIONS).toBe(6);
    expect(fake.stream).toHaveBeenCalledTimes(6);
    expect(events.at(-1)).toEqual({ type: "text", content: ITERATION_CAP_MESSAGE });
  });

  it("retries once when the model fails before anything was sent", async () => {
    const fake = fakeAnthropic([
      { content: [], stopReason: "end_turn", failBeforeEvents: new Error("ECONNRESET") },
      { texts: ["Hola"], content: [], stopReason: "end_turn" },
    ]);

    expect(await collect(streamBookingTurn(input(fake.client)))).toEqual([{ type: "text", content: "Hola" }]);
    expect(fake.stream).toHaveBeenCalledTimes(2);
  });

  it("does not retry once something was sent; the error propagates", async () => {
    const fake = fakeAnthropic([
      { content: [toolUse("tu_1")], stopReason: "tool_use" },
      { texts: ["Hola"], content: [], stopReason: "end_turn", failAfterText: new Error("socket hang up") },
      { texts: ["never"], content: [], stopReason: "end_turn" },
    ]);

    await expect(collect(streamBookingTurn(input(fake.client)))).rejects.toThrow("socket hang up");
    expect(fake.stream).toHaveBeenCalledTimes(2);
  });

  it("retries when the model fails mid-answer before anything reached the visitor", async () => {
    const fake = fakeAnthropic([
      { texts: ["Hola"], content: [], stopReason: "end_turn", failAfterText: new Error("socket hang up") },
      { texts: ["Hola de nuevo"], content: [], stopReason: "end_turn" },
    ]);

    expect(await collect(streamBookingTurn(input(fake.client)))).toEqual([{ type: "text", content: "Hola de nuevo" }]);
    expect(fake.stream).toHaveBeenCalledTimes(2);
  });

  it("keeps the cached system block identical across turns and puts the per-turn state in the unmarked block", async () => {
    const first = fakeAnthropic([{ content: [], stopReason: "end_turn" }]);
    const second = fakeAnthropic([{ content: [], stopReason: "end_turn" }]);

    await collect(streamBookingTurn(input(first.client)));
    await collect(
      streamBookingTurn(
        input(second.client, {
          draft: { ...draft, partySize: 6 },
          contextText: "El Sella nace en los Picos de Europa.",
        })
      )
    );

    const systemA = requiredValue(first.calls[0], "src/lib/booking/agent.test.ts:210 first.calls[0]").params.system as { text: string; cache_control?: unknown }[];
    const systemB = requiredValue(second.calls[0], "src/lib/booking/agent.test.ts:211 second.calls[0]").params.system as { text: string; cache_control?: unknown }[];
    expect(requiredValue(systemA[0], "src/lib/booking/agent.test.ts:212 systemA[0]").cache_control).toEqual({ type: "ephemeral" });
    expect(JSON.stringify(systemA[0])).toBe(JSON.stringify(systemB[0]));
    expect(requiredValue(systemA[0], "src/lib/booking/agent.test.ts:214 systemA[0]").text).toContain("RESERVAS DE EXPERIENCIAS");
    expect(requiredValue(systemB[1], "src/lib/booking/agent.test.ts:215 systemB[1]").cache_control).toBeUndefined();
    expect(requiredValue(systemB[1], "src/lib/booking/agent.test.ts:216 systemB[1]").text).toContain('"partySize":6');
    expect(requiredValue(systemB[1], "src/lib/booking/agent.test.ts:217 systemB[1]").text).toContain("2026-11-20");
    expect(requiredValue(systemB[1], "src/lib/booking/agent.test.ts:218 systemB[1]").text).toContain("El Sella nace en los Picos de Europa.");
    expect(countCacheBreakpoints({ system: systemB })).toBeLessThanOrEqual(MAX_CACHE_BREAKPOINTS);
  });

  it("sends the history and the message, starting with a user turn, and the tools, model and abort signal", async () => {
    const fake = fakeAnthropic([{ content: [], stopReason: "end_turn" }]);
    const controller = new AbortController();

    await collect(
      streamBookingTurn(
        input(fake.client, {
          signal: controller.signal,
          history: [
            { role: "assistant", content: "¡Hola! ¿En qué te ayudo?" },
            { role: "user", content: "Somos cuatro" },
            { role: "assistant", content: "¿Qué día?" },
          ],
          message: "Mañana",
        })
      )
    );

    const { params, options } = requiredValue(fake.calls[0], "src/lib/booking/agent.test.ts:240 fake.calls[0]");
    expect(params.messages).toEqual([
      { role: "user", content: "Somos cuatro" },
      { role: "assistant", content: "¿Qué día?" },
      { role: "user", content: "Mañana" },
    ]);
    expect(params.tools).toEqual([{ name: "search_experiences", description: "d", input_schema: { type: "object" } }]);
    expect(params.model).toBe("claude-sonnet-5-5");
    // Thinking counts toward max_tokens (#1004): room for it plus the reply, and an explicit effort.
    expect(params.max_tokens).toBeGreaterThanOrEqual(16000);
    expect(params.output_config).toEqual({ effort: "low" });
    expect(options.signal).toBe(controller.signal);
  });

  it("never shows the text the model writes before a tool call (#1037)", async () => {
    const preamble = "Hoy es viernes 2026-10-16, así que el martes es 2026-10-20. Guardo los datos y busco.";
    const fake = fakeAnthropic([
      { texts: [preamble], content: [{ type: "text", text: preamble }, toolUse("tu_1")], stopReason: "tool_use" },
      { texts: ["Voy a preparar la oferta."], content: [toolUse("tu_2")], stopReason: "tool_use" },
      { texts: ["Hay plazas a las 10:00 y a las 16:00."], content: [], stopReason: "end_turn" },
    ]);

    const events = await collect(streamBookingTurn(input(fake.client)));
    const text = events.flatMap((e) => ((e as { type: string }).type === "text" ? [(e as { content: string }).content] : [])).join("");
    expect(text).toBe("Hay plazas a las 10:00 y a las 16:00.");
    // The model still sees its own words in the turn's tool loop.
    const third = requiredValue(fake.calls[2], "src/lib/booking/agent.test.ts third call").params.messages as { role: string; content: unknown }[];
    expect(third.at(-4)).toEqual({ role: "assistant", content: [{ type: "text", text: preamble }, toolUse("tu_1")] });
  });

  it("reports progress on every model stream event, including text before a tool call (#1045)", async () => {
    const fake = fakeAnthropic([
      { texts: ["Guardo ", "los datos."], content: [toolUse("tu_1")], stopReason: "tool_use" },
      { texts: ["Hay ", "plazas ", "a las 10:00."], content: [], stopReason: "end_turn" },
    ]);
    const onProgress = vi.fn();

    await collect(streamBookingTurn(input(fake.client, { onProgress })));
    expect(onProgress).toHaveBeenCalledTimes(5);
  });

  it("shows the answer of a turn that stops at max_tokens or refuses after writing", async () => {
    for (const stopReason of ["max_tokens", "refusal"] as const) {
      const fake = fakeAnthropic([{ texts: ["Entiendo que quieres seguir"], content: [], stopReason }]);
      expect(await collect(streamBookingTurn(input(fake.client)))).toEqual([{ type: "text", content: "Entiendo que quieres seguir" }]);
    }
  });

  it("tells the model the visitor's interface language", async () => {
    const fake = fakeAnthropic([{ content: [], stopReason: "end_turn" }]);
    await collect(streamBookingTurn(input(fake.client, { locale: "en" })));
    expect(requiredValue((requiredValue(fake.calls[0], "src/lib/booking/agent.test.ts:268 fake.calls[0]").params.system as { text: string }[])[1], "src/lib/booking/agent.test.ts:268 (fake.calls[0].params.system as { text: string }[])[1]").text).toContain("Idioma de la interfaz del visitante: en");
  });

  describe("a verified accept (#1003)", () => {
    const accepted = { id: "b1", reference: "RS-ABC123" };
    const paymentCard = { kind: "payment", bookingId: "b1", amountCents: 3000 };
    const textOf = (events: unknown[]) =>
      events.flatMap((e) => ((e as { type: string }).type === "text" ? [(e as { content: string }).content] : [])).join("");

    it("creates the payment order on the server, in the visitor's language, and calls no model", async () => {
      vi.mocked(executeBookingTool).mockResolvedValue({ isError: false, result: { ok: true }, card: paymentCard as never });
      const fake = fakeAnthropic([]);

      const events = await collect(streamBookingTurn(input(fake.client, { message: "", acceptedBooking: accepted, locale: "en" })));

      expect(fake.stream).not.toHaveBeenCalled();
      expect(executeBookingTool).toHaveBeenCalledTimes(1);
      expect(executeBookingTool).toHaveBeenCalledWith(expect.anything(), "create_payment_order", { bookingId: "b1" });
      expect(events).toContainEqual({ type: "card", card: paymentCard });
      expect(textOf(events)).toContain("RS-ABC123");
      expect(textOf(events)).toMatch(/PayPal/);
      expect(textOf(events)).not.toMatch(/señal|retenida/);
    });

    it("speaks Spanish when the visitor's language is Spanish, unknown or not a locale", async () => {
      vi.mocked(executeBookingTool).mockResolvedValue({ isError: false, result: { ok: true }, card: paymentCard as never });
      for (const locale of ["es", null, "toString", "xx"]) {
        const events = await collect(streamBookingTurn(input(fakeAnthropic([]).client, { message: "", acceptedBooking: accepted, locale })));
        expect(textOf(events)).toContain("RS-ABC123");
        expect(textOf(events)).toMatch(/señal/);
      }
    });

    it("when the order cannot be created, points to the booking page and shows no payment card", async () => {
      vi.mocked(executeBookingTool).mockResolvedValue({ isError: true, result: { error: "payment_unavailable" } });
      const fake = fakeAnthropic([]);

      const events = await collect(streamBookingTurn(input(fake.client, { message: "", acceptedBooking: accepted, locale: "en" })));

      expect(fake.stream).not.toHaveBeenCalled();
      expect(events.some((e) => (e as { type: string }).type === "card")).toBe(false);
      expect(textOf(events)).toContain("RS-ABC123");
      expect(textOf(events)).toMatch(/View booking/);
    });
  });

  it("logs a turn cut at max_tokens instead of ending it silently (#1004)", async () => {
    const fake = fakeAnthropic([{ texts: ["Entiendo que quieres seguir, pero la señ"], content: [], stopReason: "max_tokens" }]);
    await collect(streamBookingTurn(input(fake.client)));
    expect(logger.warn).toHaveBeenCalledWith("[BOOKING_CHAT_MAX_TOKENS]", expect.objectContaining({ userId: "user-1" }));
  });

  it("treats a refusal before any text as a model failure (the route answers ai_unavailable)", async () => {
    const fake = fakeAnthropic([
      { content: [], stopReason: "refusal" },
      { content: [], stopReason: "refusal" },
    ]);
    await expect(collect(streamBookingTurn(input(fake.client)))).rejects.toThrow(/refusal/);
    expect(logger.warn).toHaveBeenCalledWith("[BOOKING_CHAT_REFUSAL]", expect.objectContaining({ userId: "user-1" }));
  });
});

