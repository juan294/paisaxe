/** Synthetic provider HTTP only. Never select this transport from a product request/env flag. */
import { randomUUID } from "node:crypto";
import { deterministicIntake } from "../../src/lib/booking/intake-candidates";
import { bookingIntakeHttpFixture } from "./booking-intake-http-fixture";
import type { JevQuestionSet, JevState } from "../../src/lib/jev/contracts";
import { CHAT_MODEL } from "../../src/lib/models";
function sse(
  block:
    | { type: "text"; text: string }
    | {
        type: "tool_use";
        id: string;
        name: string;
        input: Record<string, unknown>;
      },
): Response {
  const tool = block.type === "tool_use";
  const events = [
    {
      type: "message_start",
      message: {
        id: `msg_${randomUUID()}`,
        type: "message",
        role: "assistant",
        model: CHAT_MODEL,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    },
    {
      type: "content_block_start",
      index: 0,
      content_block: tool
        ? { type: "tool_use", id: block.id, name: block.name, input: {} }
        : { type: "text", text: "" },
    },
    {
      type: "content_block_delta",
      index: 0,
      delta: tool
        ? {
            type: "input_json_delta",
            partial_json: JSON.stringify(block.input),
          }
        : { type: "text_delta", text: block.text },
    },
    { type: "content_block_stop", index: 0 },
    {
      type: "message_delta",
      delta: {
        stop_reason: tool ? "tool_use" : "end_turn",
        stop_sequence: null,
      },
      usage: { output_tokens: 20 },
    },
    { type: "message_stop" },
  ];
  return new Response(
    events
      .map(
        (event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      )
      .join(""),
    { headers: { "content-type": "text/event-stream" } },
  );
}
export function createBookingHttpFixtureTransport(
  now: Date = new Date("2026-10-28T10:00:00Z"),
) {
  const counts = { jev: 0, claude: 0, voyage: 0 };
  const providerFetch: typeof globalThis.fetch = async (url, init) => {
    const target = String(url);
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (target === "https://api.typesafe.ai/v1/systemone") {
      counts.jev++;
      const response = bookingIntakeHttpFixture({
        state: body.state as JevState,
        questionSet: {
          version: "booking-intake-v1",
          questions: body.questions,
        } as JevQuestionSet,
      });
      return Response.json(response.body, { status: response.status });
    }
    if (target === "https://api.anthropic.com/v1/messages") {
      counts.claude++;
      const system = typeof body.system === "string"
        ? body.system
        : Array.isArray(body.system)
          ? body.system.map((block: { text?: string }) => block.text ?? "").join("\n")
          : "";
      const english = /(?:Idioma de la interfaz del visitante|Visitor interface language):\s*en\b/.test(system);
      const messages = body.messages as {
        role: string;
        content: string | Record<string, unknown>[];
      }[];
      const visitor =
        (messages
          .filter((m) => m.role === "user" && typeof m.content === "string")
          .at(-1)?.content as string) ?? "";
      const latest = messages.at(-1);
      const results = Array.isArray(latest?.content)
        ? latest.content.filter((block) => block.type === "tool_result")
        : [];
      const assistant = messages
        .filter((m) => m.role === "assistant" && Array.isArray(m.content))
        .at(-1);
      const calls = Array.isArray(assistant?.content)
        ? assistant.content.filter((block) => block.type === "tool_use")
        : [];
      const lastResult = results.at(-1);
      const lastCall = calls.find(
        (call) => call.id === lastResult?.tool_use_id,
      );
      const tool = (name: string, input: Record<string, unknown>) =>
        sse({ type: "tool_use", id: `tool_${randomUUID()}`, name, input });
      if (lastCall?.name === "get_quote")
        return sse({
          type: "text",
          text: english
            ? "Here is the catalog offer. No booking has been confirmed yet."
            : "Aquí tienes la oferta del catálogo. Todavía no se ha confirmado ninguna reserva.",
        });
      if (lastCall?.name === "search_experiences" && lastResult) {
        const data = JSON.parse(String(lastResult.content)) as {
          options?: { title: string; displayTitle?: string; experienceId: string }[];
        };
        const named = data.options?.find((option) =>
          [option.title, ...(english && option.displayTitle ? [option.displayTitle] : [])].some((title) =>
            visitor.toLocaleLowerCase(english ? "en" : "es").includes(title.toLocaleLowerCase(english ? "en" : "es")),
          ),
        );
        const criteria = lastCall.input as Record<string, unknown>;
        if (named) {
          const time = visitor.match(
            /\b(?:a las )?([01]\d|2[0-3]):([0-5]\d)\b/,
          );
          if (time)
            return tool("get_quote", {
              experienceId: named.experienceId,
              date: criteria.date,
              time: `${time[1]}:${time[2]}`,
              partySize: criteria.partySize,
            });
        }
        return sse({
          type: "text",
          text: english
            ? `Catalog options: ${(data.options ?? []).map((option) => option.displayTitle ?? option.title).join("; ")}. Tell me the exact name, date, party size and time to request an offer.`
            : `Opciones del catálogo: ${(data.options ?? []).map((option) => option.title).join("; ")}. Dime el nombre exacto, fecha, personas y hora para pedir una oferta.`,
        });
      }
      const literal = deterministicIntake(visitor, now);
      if (literal.status === "accepted")
        return tool("search_experiences", { ...literal.criteria });
      const date = visitor.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
      const party = visitor.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:personas?|people|persons?|adults?|friends?)\b/i)?.[1];
      const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
      if (date && party)
        return tool("search_experiences", { date, partySize: numberWords[party.toLowerCase()] ?? Number(party) });
      return sse({
        type: "text",
        text: english
          ? "Please provide an exact date and party size to search for options."
          : "Indica una fecha exacta y el número de personas para buscar opciones.",
      });
    }
    if (new URL(target).hostname === "api.voyageai.com") {
      counts.voyage++;
      return Response.json({
        results: [{ embeddings: [Array(512).fill(0)] }],
        data: [],
        total_tokens: 1,
        usage: { total_tokens: 1 },
      });
    }
    throw new Error(
      "Synthetic booking fixture refuses an unregistered external provider endpoint.",
    );
  };
  return { providerFetch, counts };
}
