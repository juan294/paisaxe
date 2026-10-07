/**
 * The booking conversation's tool loop (PayPal hackathon plan, Phase 3).
 *
 * Streams one visitor turn through the Anthropic SDK with the booking tools:
 * text deltas are yielded as they arrive; when the model asks for tools they
 * run one after another (so two get_quote calls on one draft never race),
 * their status and cards are yielded, and the model continues with the
 * results. At most MAX_TOOL_ITERATIONS model calls per turn.
 *
 * Always the SDK transport: the curl transport in src/lib/claude.ts yields text
 * only and cannot carry tool_use (Phase 0 spike, notes deviation 3).
 *
 * Prompt caching (.claude/rules/prompt-caching.md): the persona and the
 * booking rules form the cached system block; the per-turn state (today's
 * date, draft, bookings, retrieved guide context) is the unmarked block after it.
 *
 * The turn right after "Accept offer" runs no model (#1003): the server creates
 * the payment order through the same tool and answers with a fixed line in the
 * visitor's language. Asking the model to do it made it re-quote, or refuse the
 * synthetic "I accepted" text as an acceptance by text.
 */
import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { buildSystemBlocks } from "@/lib/cached-system";
import { buildBookingInstructions, buildSystemPrompt } from "@/lib/chat-config";
import { recordAnthropicUsageInBackground } from "@/lib/costs/anthropic-usage";
import { getEnv } from "@/lib/env";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";
import { de } from "@/lib/i18n/de";
import { pt } from "@/lib/i18n/pt";
import { ast } from "@/lib/i18n/ast";
import { resolveTranslation } from "@/lib/i18n/resolve";
import type { Translations } from "@/lib/i18n/types";
import { logger } from "@/lib/logger";
import { CHAT_MODEL } from "@/lib/models";
import type { BookingChatHistoryItem } from "@/types/booking-chat";
import type { ChatStreamEvent } from "@/types/sse";
import type { BookingDraft } from "./drafts";
import { bookingToolDefinitions, executeBookingTool, type ToolContext } from "./tools";
import { madridDate, type Booking } from "./types";
import type { BookingModelClient } from "./model-client";

export const MAX_TOOL_ITERATIONS = 6;
export const ITERATION_CAP_MESSAGE =
  "No he podido completar este paso; prueba a concretar fecha y personas.";
/** Thinking counts toward max_tokens (#1004); streamed, so a large cap is safe. */
const MAX_TOKENS = 16000;
/** Claude Sonnet 5.5 effort levels are recalibrated; low is the starting point for chat (#1005). */
const EFFORT = "low" as const;
const TRANSLATIONS: Record<string, Translations> = { es, en, fr, de, pt, ast };

export async function createBookingModelClient(): Promise<BookingModelClient> {
  // Local release probes only: a scripted model replaying a recorded tool
  // sequence (replay-model.ts refuses production and Vercel processes).
  const replay = getEnv("BOOKING_AGENT_REPLAY");
  if (replay) return (await import("./replay-model")).createReplayModelClient(replay);
  const { default: AnthropicSDK } = await import("@anthropic-ai/sdk");
  return new AnthropicSDK({ maxRetries: 1 });
}

export interface BookingTurnInput {
  anthropic: BookingModelClient;
  tools: ToolContext;
  /** The visitor's text; empty only on the post-accept turn, which runs no model. */
  message: string;
  history: BookingChatHistoryItem[];
  draft: BookingDraft;
  bookings: Booking[];
  /** Retrieved guide passages for descriptive questions, already formatted. */
  contextText: string | null;
  /** Set when the server verified a quote_accepted event for this turn. */
  acceptedBooking: { id: string; reference: string } | null;
  /** The visitor's interface language (es, en, fr, de, pt, ast), when known. */
  locale?: string | null;
  signal: AbortSignal;
  now?: Date;
}

function stateBlock(input: BookingTurnInput, now: Date): string {
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "Europe/Madrid" }).format(now);
  const draft = {
    partySize: input.draft.partySize,
    date: input.draft.slotDate,
    time: input.draft.slotTime,
    budgetCents: input.draft.budgetCents,
    constraints: input.draft.constraints,
  };
  const bookings = input.bookings.map((booking) => ({
    bookingId: booking.id,
    reference: booking.reference,
    status: booking.status,
    date: booking.slotDate,
    time: booking.slotTime,
    partySize: booking.partySize,
  }));

  const lines = [
    "# ESTADO DE LA RESERVA (datos del servidor)",
    `Hoy en Asturias es ${weekday}, ${madridDate(now)}.`,
    `Borrador: ${JSON.stringify(draft)}`,
    `Reservas del visitante: ${bookings.length > 0 ? JSON.stringify(bookings) : "ninguna"}`,
  ];
  if (input.locale) lines.push(`Idioma de la interfaz del visitante: ${input.locale}`);
  if (input.contextText) {
    lines.push("", "# CONTEXTO DE LA GUÍA", `<context>${input.contextText}</context>`);
  }
  return lines.join("\n");
}

/** History plus this turn as alternating messages that start and end with the visitor. */
function conversation(input: BookingTurnInput): Anthropic.MessageParam[] {
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  const append = (role: "user" | "assistant", text: string) => {
    const content = text.trim();
    if (!content || (turns.length === 0 && role !== "user")) return;
    const last = turns.at(-1);
    if (last?.role === role) last.content = `${last.content}\n\n${content}`;
    else turns.push({ role, content });
  };

  for (const item of input.history) append(item.role, item.content);
  append("user", input.message.trim());
  return turns;
}

async function* runTurn(input: BookingTurnInput, now: Date): AsyncGenerator<ChatStreamEvent> {
  const system = buildSystemBlocks(`${buildSystemPrompt()}\n\n${buildBookingInstructions()}`, stateBlock(input, now));
  const tools = bookingToolDefinitions();
  const messages = conversation(input);

  let textSent = false;
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = input.anthropic.messages.stream(
      { model: CHAT_MODEL, max_tokens: MAX_TOKENS, output_config: { effort: EFFORT }, system, tools, messages },
      { signal: input.signal }
    );
    // A later iteration's text starts a new paragraph after earlier text.
    let separate = textSent;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
        yield { type: "text", content: separate ? `\n\n${event.delta.text}` : event.delta.text };
        separate = false;
        textSent = true;
      }
    }

    const final = await stream.finalMessage();
    recordAnthropicUsageInBackground({ model: CHAT_MODEL, usage: final.usage, source: "booking_chat" });
    if (final.stop_reason === "refusal") {
      logger.warn("[BOOKING_CHAT_REFUSAL]", { userId: input.tools.userId, textSent });
      // Before any text the route answers ai_unavailable; after it, the turn just ends.
      if (!textSent) throw new Error("refusal");
      return;
    }
    if (final.stop_reason === "max_tokens") {
      logger.warn("[BOOKING_CHAT_MAX_TOKENS]", { userId: input.tools.userId, outputTokens: final.usage.output_tokens });
      return;
    }
    if (final.stop_reason !== "tool_use") return;

    messages.push({ role: "assistant", content: final.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      yield { type: "tool", name: block.name, status: "start" };
      const outcome = await executeBookingTool(input.tools, block.name, block.input);
      yield { type: "tool", name: block.name, status: outcome.isError ? "error" : "done" };
      if (outcome.card) yield { type: "card", card: outcome.card };
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(outcome.result),
        is_error: outcome.isError,
      });
    }
    messages.push({ role: "user", content: results });
  }

  yield { type: "text", content: ITERATION_CAP_MESSAGE };
}

/**
 * One booking turn as SSE events (text, tool, card). The route adds `done`
 * and maps a thrown error to an `ai_unavailable` error event. A model failure
 * before anything was sent is retried once (same rule as src/lib/claude.ts).
 */
export async function* streamBookingTurn(input: BookingTurnInput): AsyncGenerator<ChatStreamEvent> {
  if (input.acceptedBooking) {
    yield* acceptedTurn(input, input.acceptedBooking);
    return;
  }
  const now = input.now ?? new Date();
  let yieldedAny = false;

  for (let attempt = 1; ; attempt++) {
    try {
      for await (const event of runTurn(input, now)) {
        yieldedAny = true;
        yield event;
      }
      return;
    } catch (error) {
      if (yieldedAny || attempt >= 2 || input.signal.aborted) throw error;
    }
  }
}

/** The fixed post-accept line, in the visitor's language (Spanish when unknown). */
function acceptedLine(locale: string | null | undefined, key: string, reference: string): string {
  const translations = locale && Object.hasOwn(TRANSLATIONS, locale) ? TRANSLATIONS[locale] : es;
  return resolveTranslation(key, translations).replace("{reference}", reference);
}

/** The turn after "Accept offer": the payment order and its card, no model (#1003). */
async function* acceptedTurn(input: BookingTurnInput, booking: { id: string; reference: string }): AsyncGenerator<ChatStreamEvent> {
  yield { type: "tool", name: "create_payment_order", status: "start" };
  const outcome = await executeBookingTool(input.tools, "create_payment_order", { bookingId: booking.id });
  yield { type: "tool", name: "create_payment_order", status: outcome.isError ? "error" : "done" };
  if (outcome.isError) {
    logger.warn("[BOOKING_CHAT_ACCEPT_PAYMENT_FAILED]", { userId: input.tools.userId, bookingId: booking.id });
    yield { type: "text", content: acceptedLine(input.locale, "booking.chat.acceptedPayOnPage", booking.reference) };
    return;
  }
  yield { type: "text", content: acceptedLine(input.locale, "booking.chat.acceptedPayNext", booking.reference) };
  if (outcome.card) yield { type: "card", card: outcome.card };
}
