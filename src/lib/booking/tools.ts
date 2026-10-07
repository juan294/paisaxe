/**
 * Model-callable booking tools (PayPal hackathon plan, Phase 3).
 *
 * Every tool validates its input with zod, acts as the acting user (ids are
 * re-checked by the scoped reads underneath) and takes ids and constraint
 * values only, never a price or an amount. Results go back to the model as
 * tool_result content; cards go only to the browser. A capability link or URL
 * never appears in a result (F05).
 *
 * Phase 4 adds create_payment_order; Phase 5 adds preview_cancellation, which
 * is read-only: no tool can confirm a cancellation (F01). Phase 8a adds
 * send_balance_invoice.
 */
import "server-only";

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { BookingCard, BookingSummaryCard } from "@/types/booking-cards";
import { searchExperiences } from "./availability";
import { getBookingForUser, listBookingsForUser } from "./bookings";
import { cancellationPreview } from "./cancel";
import { ensurePaymentOrder } from "./capture";
import { draftPatchSchema, getOrCreateOpenDraft, updateDraft, type BookingDraft } from "./drafts";
import { visitorConstraintsSchema } from "./facts";
import { sendBalanceInvoice } from "./invoice";
import { bookingCapability, bookingLink } from "./links";
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

const createPaymentOrderTool: BookingTool<{ bookingId: string }> = {
  name: "create_payment_order",
  description:
    "Prepara el pago de la señal en PayPal para una reserva aceptada del visitante (estado pending_payment). Devuelve la " +
    "tarjeta de pago con el botón de PayPal; el visitante paga allí antes de que caduque la plaza retenida. " +
    "Crear el pedido no es un pago: la reserva solo está confirmada cuando get_booking_status dice confirmed. " +
    "payment_in_progress significa que el visitante ya aprobó el pago y se está confirmando: no le pidas pagar otra vez.",
  inputSchema: z.object({ bookingId: z.guid() }).strict(),
  async execute(ctx, input) {
    const booking = await getBookingForUser(ctx.client, ctx.userId, input.bookingId);
    if (!booking) throw new BookingError("not_found");
    const order = await ensurePaymentOrder(ctx.client, booking.id);

    return {
      // The approval URL carries PayPal's order token: card only (F05).
      result: { payment: "order_created", reference: booking.reference },
      card: {
        kind: "payment",
        bookingId: booking.id,
        approvalUrl: order.approveUrl,
        amountCents: order.amountCents,
        currency: order.currency,
        expiresAt: order.expiresAt,
      },
    };
  },
};

const previewCancellationTool: BookingTool<{ bookingId: string }> = {
  name: "preview_cancellation",
  description:
    "Calcula, sin cambiar nada, cuánto se devolvería si el visitante cancelara ahora una reserva confirmada: la señal " +
    "completa hasta cancellationWindowHours antes del inicio, nada después. Devuelve la tarjeta de cancelación; el visitante " +
    "confirma con su botón. Tú no puedes cancelar: no digas que una reserva está cancelada hasta que get_booking_status lo diga.",
  inputSchema: z.object({ bookingId: z.guid() }).strict(),
  async execute(ctx, input) {
    const booking = await getBookingForUser(ctx.client, ctx.userId, input.bookingId);
    if (!booking) throw new BookingError("not_found");
    const terms = await cancellationPreview(ctx.client, booking);

    return {
      result: {
        reference: booking.reference,
        refundEuros: euros(terms.refundCents),
        depositEuros: euros(terms.depositCents),
        cancellationWindowHours: terms.cancellationWindowHours,
        slotStart: terms.slotStart,
        refundUntil: terms.termsValidUntil,
        next: "El visitante confirma la cancelación con el botón de la tarjeta.",
      },
      // The capability goes to the card's button only, never to the model (F05).
      card: { kind: "cancellation", bookingId: booking.id, capability: bookingCapability(booking), ...terms },
    };
  },
};

const sendBalanceInvoiceTool: BookingTool<{ bookingId: string }> = {
  name: "send_balance_invoice",
  description:
    "Envía por PayPal la factura del resto (total menos la señal) de una reserva confirmada del visitante, con vencimiento " +
    "el día de la actividad, al correo de la cuenta PayPal con la que pagó la señal. Si la reserva ya tiene factura no crea " +
    "otra: devuelve su estado (sent, payment_pending, partially_paid, paid o cancelled). La tarjeta lleva el enlace de pago. El resto " +
    "solo está pagado cuando el estado es paid.",
  inputSchema: z.object({ bookingId: z.guid() }).strict(),
  async execute(ctx, input) {
    const booking = await getBookingForUser(ctx.client, ctx.userId, input.bookingId);
    if (!booking) throw new BookingError("not_found");
    const invoice = await sendBalanceInvoice(ctx.client, booking);

    return {
      // The invoice link and the payer's email stay out of the model's view (F05).
      result: {
        invoice: invoice.status,
        alreadySent: !invoice.created,
        reference: booking.reference,
        balanceEuros: euros(booking.balanceCents),
        dueDate: booking.slotDate,
        next: "La factura llega al correo de la cuenta PayPal con la que se pagó la señal; también puede pagarla con el botón de la tarjeta.",
      },
      card: {
        kind: "invoice",
        bookingId: booking.id,
        reference: booking.reference,
        amountCents: booking.balanceCents,
        currency: booking.currency,
        dueDate: booking.slotDate,
        status: invoice.status,
        invoiceUrl: invoice.url,
      },
    };
  },
};

const BOOKING_TOOLS = [
  searchExperiencesTool,
  updateDraftTool,
  getQuoteTool,
  getBookingStatusTool,
  createPaymentOrderTool,
  previewCancellationTool,
  sendBalanceInvoiceTool,
] as const;

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
