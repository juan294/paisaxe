/**
 * Model-callable booking tools (PayPal hackathon plan, Phase 3).
 *
 * Every tool validates its input with zod, acts as the acting user (ids are
 * re-checked by the scoped reads underneath) and takes ids and constraint
 * values only, never a price or an amount. Results go back to the model as
 * tool_result content; cards go only to the browser. A capability link or URL
 * never appears in a result (F05).
 *
 * Phase 4 adds create_payment_order; Phase 5 adds preview_cancellation.
 */
import "server-only";

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { BookingCard, BookingSummaryCard } from "@/types/booking-cards";
import { searchExperiences } from "./availability";
import { getBookingForUser, listBookingsForUser } from "./bookings";
import { draftPatchSchema, getOrCreateOpenDraft, updateDraft, type BookingDraft } from "./drafts";
import { visitorConstraintsSchema } from "./facts";
import { bookingLink } from "./links";
import { createQuote } from "./quotes";
import { BookingError, hhmmSchema, isoDateSchema, partySizeSchema, type Booking } from "./types";

/** Budget per tool execution; the turn continues with an is_error result. */
const TOOL_TIMEOUT_MS = 8_000;
/** Slots per option sent to the model; the card carries the same list. */
const SLOTS_PER_OPTION = 8;

export interface ToolContext {
  userId: string;
  redemptionId: string;
  client: SupabaseClient;
}

export interface ToolOutcome {
  /** JSON-serializable content of the tool_result the model sees. */
  result: unknown;
  /** Sent to the browser as an SSE card event; never to the model. */
  card?: BookingCard;
  isError: boolean;
}

interface BookingTool<Input> {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  execute(ctx: ToolContext, input: Input): Promise<Omit<ToolOutcome, "isError">>;
}

const euros = (cents: number) => (cents / 100).toFixed(2);

function draftState(draft: BookingDraft) {
  return {
    partySize: draft.partySize,
    date: draft.slotDate,
    time: draft.slotTime,
    budgetEuros: draft.budgetCents === null ? null : euros(draft.budgetCents),
    constraints: draft.constraints,
  };
}

function bookingState(booking: Booking) {
  return {
    bookingId: booking.id,
    reference: booking.reference,
    status: booking.status,
    date: booking.slotDate,
    time: booking.slotTime,
    partySize: booking.partySize,
    depositEuros: euros(booking.depositCents),
    balanceEuros: euros(booking.balanceCents),
  };
}

/** The booking card (with its capability link) for a booking the visitor owns. */
export function bookingCard(booking: Booking): BookingSummaryCard {
  return {
    kind: "booking",
    bookingId: booking.id,
    reference: booking.reference,
    status: booking.status,
    link: bookingLink(booking),
  };
}

const searchInputSchema = z
  .object({
    partySize: partySizeSchema.optional(),
    date: isoDateSchema.optional(),
    budgetCents: z.number().int().min(0).max(10_000_000).optional(),
    constraints: visitorConstraintsSchema.optional(),
  })
  .strict();

const quoteInputSchema = z
  .object({
    experienceId: z.guid(),
    date: isoDateSchema,
    time: hhmmSchema,
    partySize: partySizeSchema,
  })
  .strict();

const searchExperiencesTool: BookingTool<z.infer<typeof searchInputSchema>> = {
  name: "search_experiences",
  description:
    "Busca las experiencias reservables y su disponibilidad. Los criterios que no indiques se toman del borrador de la reserva. " +
    "Devuelve TODAS las opciones, también las descartadas, con el motivo y el veredicto de cada necesidad del visitante " +
    "(supported, unsupported, unknown) según los datos del proveedor.",
  inputSchema: searchInputSchema,
  async execute(ctx, input) {
    const draft = await getOrCreateOpenDraft(ctx.client, ctx.userId);
    const results = await searchExperiences(ctx.client, {
      partySize: input.partySize ?? draft.partySize,
      date: input.date ?? draft.slotDate,
      budgetCents: input.budgetCents ?? draft.budgetCents,
      constraints: input.constraints ?? draft.constraints,
    });
    const options = results.map((r) => ({
      experienceId: r.experience.id,
      title: r.experience.title,
      priceCents: r.experience.priceCents,
      depositCents: r.experience.depositCents,
      currency: r.experience.currency,
      maxParty: r.experience.maxParty,
      suitability: r.suitability,
      reasons: r.reasons,
      verdicts: r.verdicts,
      slots: (r.slots.length > 0 ? r.slots : r.alternatives).slice(0, SLOTS_PER_OPTION),
    }));
    return {
      result: {
        options: results.map((r, i) => ({
          experienceId: r.experience.id,
          title: r.experience.title,
          description: r.experience.description,
          priceEuros: euros(r.experience.priceCents),
          depositEuros: euros(r.experience.depositCents),
          maxParty: r.experience.maxParty,
          durationMinutes: r.experience.durationMinutes,
          suitability: r.suitability,
          reasons: r.reasons,
          verdicts: r.verdicts,
          slots: r.slots.slice(0, SLOTS_PER_OPTION),
          alternatives: r.alternatives.slice(0, SLOTS_PER_OPTION),
          slotsShown: options[i].slots.length,
        })),
      },
      card: { kind: "offer", options },
    };
  },
};

const updateDraftTool: BookingTool<z.infer<typeof draftPatchSchema>> = {
  name: "update_booking_draft",
  description:
    "Guarda en el borrador lo que el visitante ha dicho: número de personas, fecha (AAAA-MM-DD), hora (HH:MM), " +
    "presupuesto en céntimos y necesidades (step_free, public_transport, pets, min_age = edad del más pequeño, language). " +
    "Envía solo los campos que cambian; constraints sustituye la lista completa.",
  inputSchema: draftPatchSchema,
  async execute(ctx, input) {
    const draft = await updateDraft(ctx.client, ctx.userId, input);
    return { result: { draft: draftState(draft) } };
  },
};

const getQuoteTool: BookingTool<z.infer<typeof quoteInputSchema>> = {
  name: "get_quote",
  description:
    "Crea una oferta (versión nueva) para una experiencia, fecha, hora y número de personas. El precio y la señal salen del " +
    "catálogo, nunca de la conversación. Devuelve la tarjeta de oferta; el visitante la acepta con el botón de la tarjeta.",
  inputSchema: quoteInputSchema,
  async execute(ctx, input) {
    const draft = await getOrCreateOpenDraft(ctx.client, ctx.userId);
    const quote = await createQuote(ctx.client, ctx.userId, {
      draftId: draft.id,
      experienceId: input.experienceId,
      slotDate: input.date,
      slotTime: input.time,
      partySize: input.partySize,
    });
    const { data } = await ctx.client.from("experiences").select("title").eq("id", quote.experienceId).maybeSingle();
    const experienceTitle = (data?.title as string | undefined) ?? "";

    return {
      result: {
        quoteId: quote.id,
        version: quote.version,
        experienceTitle,
        date: quote.slotDate,
        time: quote.slotTime,
        partySize: quote.partySize,
        totalEuros: euros(quote.totalCents),
        depositEuros: euros(quote.depositCents),
        balanceEuros: euros(quote.balanceCents),
        cancellationWindowHours: quote.cancellationWindowHours,
        expiresAt: quote.expiresAt,
        next: "Pide al visitante que revise la tarjeta y pulse el botón para aceptar la oferta.",
      },
      card: {
        kind: "quote",
        quoteId: quote.id,
        version: quote.version,
        experienceTitle,
        slotDate: quote.slotDate,
        slotTime: quote.slotTime,
        partySize: quote.partySize,
        totalCents: quote.totalCents,
        depositCents: quote.depositCents,
        balanceCents: quote.balanceCents,
        currency: quote.currency,
        cancellationWindowHours: quote.cancellationWindowHours,
        expiresAt: quote.expiresAt,
        accepted: false,
      },
    };
  },
};

const getBookingStatusTool: BookingTool<{ bookingId?: string }> = {
  name: "get_booking_status",
  description:
    "Consulta el estado de una reserva del visitante (o de todas si no indicas bookingId). Úsalo antes de afirmar que una " +
    "reserva está confirmada. La tarjeta que devuelve incluye el enlace de la reserva.",
  inputSchema: z.object({ bookingId: z.guid().optional() }).strict(),
  async execute(ctx, input) {
    const bookings = input.bookingId
      ? [await getBookingForUser(ctx.client, ctx.userId, input.bookingId)].filter((b): b is Booking => b !== null)
      : await listBookingsForUser(ctx.client, ctx.userId);
    if (input.bookingId && bookings.length === 0) throw new BookingError("not_found");

    return {
      result: { bookings: bookings.map(bookingState) },
      card: bookings[0] ? bookingCard(bookings[0]) : undefined,
    };
  },
};

const BOOKING_TOOLS = [searchExperiencesTool, updateDraftTool, getQuoteTool, getBookingStatusTool] as const;

/** Tool definitions for messages.stream, with JSON schemas derived from the zod schemas. */
export function bookingToolDefinitions(): Anthropic.Tool[] {
  return BOOKING_TOOLS.map((tool) => {
    const inputSchema = z.toJSONSchema(tool.inputSchema) as Record<string, unknown>;
    delete inputSchema.$schema;
    return {
      name: tool.name,
      description: tool.description,
      input_schema: inputSchema as Anthropic.Tool["input_schema"],
    };
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Runs one tool call. Never throws: every failure becomes an is_error result. */
export async function executeBookingTool(ctx: ToolContext, name: string, rawInput: unknown): Promise<ToolOutcome> {
  const tool = BOOKING_TOOLS.find((candidate) => candidate.name === name) as BookingTool<unknown> | undefined;
  if (!tool) return { isError: true, result: { error: "unknown_tool" } };

  const parsed = tool.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      isError: true,
      result: { error: "invalid_input", detail: parsed.error.issues.map((issue) => issue.message).join("; ") },
    };
  }

  const startedAt = Date.now();
  try {
    const outcome = await withTimeout(tool.execute(ctx, parsed.data), TOOL_TIMEOUT_MS);
    // Per-tool latency, to decide whether search needs a range availability RPC (Phase 1 notes).
    logger.info("[BOOKING_TOOL_TIMING]", { tool: name, durationMs: Date.now() - startedAt });
    if (outcome === "timeout") {
      logger.warn("[BOOKING_TOOL_TIMEOUT]", { tool: name, timeoutMs: TOOL_TIMEOUT_MS });
      return { isError: true, result: { error: "timeout" } };
    }
    return { ...outcome, isError: false };
  } catch (error) {
    if (error instanceof BookingError) {
      return { isError: true, result: { error: error.code, detail: error.message } };
    }
    logger.error("[BOOKING_TOOL_FAILED]", {
      tool: name,
      error: error instanceof Error ? error.message : String(error),
    });
    return { isError: true, result: { error: "internal_error" } };
  }
}
