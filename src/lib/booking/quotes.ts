/**
 * Quotes: versioned offers for one experience, slot and party, and their
 * acceptance through the atomic accept_quote RPC (migration 113, F04).
 *
 * Price and deposit always come from the experience row; any amount in the
 * caller's input is ignored.
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAvailability } from "./availability";
import { bookingLink } from "./links";
import {
  BookingError,
  QUOTE_TTL_MINUTES,
  UNIQUE_VIOLATION,
  hhmmSchema,
  isUuid,
  isoDateSchema,
  mapBooking,
  mapExperience,
  mapQuote,
  parseOrThrow,
  partySizeSchema,
  type Booking,
  type Quote,
} from "./types";

const quoteInputSchema = z.object({
  draftId: z.string().min(1),
  experienceId: z.string().min(1),
  slotDate: isoDateSchema,
  slotTime: hhmmSchema,
  partySize: partySizeSchema,
});

type QuoteInput = z.infer<typeof quoteInputSchema>;

/** accept_quote raises these codes as the error message. */
const ACCEPT_ERRORS = new Set(["not_found", "quote_expired", "no_capacity"] as const);

export async function createQuote(
  client: SupabaseClient,
  userId: string,
  input: QuoteInput,
  now: Date = new Date()
): Promise<Quote> {
  const { draftId, experienceId, slotDate, slotTime, partySize } = parseOrThrow(quoteInputSchema, input);

  const [draft, experienceRow] = await Promise.all([
    client.from("booking_drafts").select("id, user_id, status").eq("id", draftId).maybeSingle(),
    client
      .from("experiences")
      .select("*, merchants(cancellation_window_hours)")
      .eq("id", experienceId)
      .eq("active", true)
      .maybeSingle(),
  ]);
  if (draft.error) throw new Error(`Failed to load draft: ${draft.error.message}`);
  if (!draft.data || draft.data.status !== "open") throw new BookingError("not_found", "No open draft");
  if (draft.data.user_id !== userId) throw new BookingError("not_owned", "Draft belongs to another user");

  if (experienceRow.error) throw new Error(`Failed to load experience: ${experienceRow.error.message}`);
  if (!experienceRow.data) throw new BookingError("not_found", "Experience not available");
  const experience = mapExperience(experienceRow.data);
  if (partySize > experience.maxParty) {
    throw new BookingError("invalid_input", `This experience takes at most ${experience.maxParty} people`);
  }

  const slot = (await listAvailability(client, experienceId, slotDate, 1)).find(
    (candidate) => candidate.startTime === slotTime
  );
  if (!slot) throw new BookingError("invalid_input", "No such start time on that date");
  if (slot.available < partySize) throw new BookingError("no_capacity", "Not enough places left");

  const merchant = experienceRow.data.merchants as { cancellation_window_hours: number };
  const row = {
    draft_id: draftId,
    user_id: userId,
    experience_id: experienceId,
    slot_date: slotDate,
    slot_time: slotTime,
    party_size: partySize,
    total_cents: experience.priceCents,
    deposit_cents: experience.depositCents,
    currency: experience.currency,
    cancellation_window_hours: merchant.cancellation_window_hours,
    expires_at: new Date(now.getTime() + QUOTE_TTL_MINUTES * 60_000).toISOString(),
  };

  // A concurrent createQuote on the same draft can take the same version
  // (unique (draft_id, version)); one retry reads the new latest version.
  for (let attempt = 1; ; attempt++) {
    const [latest, superseded] = await Promise.all([
      client
        .from("quotes")
        .select("version")
        .eq("draft_id", draftId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from("quotes")
        .update({ superseded_at: now.toISOString() })
        .eq("draft_id", draftId)
        .is("superseded_at", null)
        .is("accepted_at", null),
    ]);
    if (latest.error) throw new Error(`Failed to read quote versions: ${latest.error.message}`);
    if (superseded.error) throw new Error(`Failed to supersede quotes: ${superseded.error.message}`);

    const inserted = await client
      .from("quotes")
      .insert({ ...row, version: ((latest.data?.version as number | undefined) ?? 0) + 1 })
      .select("*")
      .single();
    if (!inserted.error) return mapQuote(inserted.data);
    if (inserted.error.code !== UNIQUE_VIOLATION || attempt === 2) {
      throw new Error(`Failed to create quote: ${inserted.error.message}`);
    }
  }
}

/** Accepts a quote: one hold and one pending_payment booking, idempotently. */
export async function acceptQuote(
  client: SupabaseClient,
  userId: string,
  quoteId: string
): Promise<{ booking: Booking; link: string }> {
  if (!isUuid(quoteId)) throw new BookingError("not_found");

  const { data, error } = await client.rpc("accept_quote", { p_quote_id: quoteId, p_user_id: userId });
  if (error) {
    const code = error.message as "not_found" | "quote_expired" | "no_capacity";
    if (ACCEPT_ERRORS.has(code)) throw new BookingError(code);
    throw new Error(`Failed to accept quote: ${error.message}`);
  }
  const booking = mapBooking(data);
  return { booking, link: bookingLink(booking) };
}
