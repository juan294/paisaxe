/**
 * Booking drafts: the conversation's working state (party, date, time,
 * budget, constraints). One open draft per user, enforced by a partial unique
 * index (migration 112).
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { visitorConstraintsSchema, type VisitorConstraints } from "./facts";
import {
  BookingError,
  UNIQUE_VIOLATION,
  addDays,
  hhmmSchema,
  isoDateSchema,
  madridDate,
  parseOrThrow,
  partySizeSchema,
  toHhMm,
} from "./types";

/** How far ahead a visitor may plan. */
const BOOKING_HORIZON_DAYS = 90;
const STALE_DRAFT_HOURS = 24;

export interface BookingDraft {
  id: string;
  userId: string;
  status: "open" | "accepted" | "abandoned";
  partySize: number | null;
  slotDate: string | null;
  slotTime: string | null;
  budgetCents: number | null;
  constraints: VisitorConstraints;
}

export const draftPatchSchema = z
  .object({
    partySize: partySizeSchema,
    date: isoDateSchema.nullable(),
    time: hhmmSchema.nullable(),
    budgetCents: z.number().int().min(0).max(10_000_000).nullable(),
    constraints: visitorConstraintsSchema,
  })
  .partial()
  .strict();

type DraftPatch = z.infer<typeof draftPatchSchema>;

function mapDraft(row: Record<string, unknown>): BookingDraft {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as BookingDraft["status"],
    partySize: (row.party_size as number | null) ?? null,
    slotDate: (row.slot_date as string | null) ?? null,
    slotTime: row.slot_time ? toHhMm(row.slot_time as string) : null,
    budgetCents: (row.budget_cents as number | null) ?? null,
    constraints: (row.constraints as VisitorConstraints | null) ?? {},
  };
}

function assertBookableDate(date: string, now: Date): void {
  const today = madridDate(now);
  if (date < today || date > addDays(today, BOOKING_HORIZON_DAYS)) {
    throw new BookingError("invalid_input", `Date must be within the next ${BOOKING_HORIZON_DAYS} days`);
  }
}

async function findOpenDraft(client: SupabaseClient, userId: string): Promise<BookingDraft | null> {
  const { data, error } = await client
    .from("booking_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw new Error(`Failed to load draft: ${error.message}`);
  return data ? mapDraft(data) : null;
}

export async function getOrCreateOpenDraft(client: SupabaseClient, userId: string): Promise<BookingDraft> {
  const existing = await findOpenDraft(client, userId);
  if (existing) return existing;

  const created = await client.from("booking_drafts").insert({ user_id: userId }).select("*").single();
  if (!created.error) return mapDraft(created.data);
  if (created.error.code !== UNIQUE_VIOLATION) {
    throw new Error(`Failed to create draft: ${created.error.message}`);
  }

  // A concurrent request created the open draft first.
  const winner = await findOpenDraft(client, userId);
  if (!winner) throw new Error("Failed to load draft after a concurrent create");
  return winner;
}

export async function updateDraft(
  client: SupabaseClient,
  userId: string,
  patch: DraftPatch,
  now: Date = new Date()
): Promise<BookingDraft> {
  const valid = parseOrThrow(draftPatchSchema, patch);
  if (valid.date) assertBookableDate(valid.date, now);

  const columns: Record<string, unknown> = {};
  if (valid.partySize !== undefined) columns.party_size = valid.partySize;
  if (valid.date !== undefined) columns.slot_date = valid.date;
  if (valid.time !== undefined) columns.slot_time = valid.time;
  if (valid.budgetCents !== undefined) columns.budget_cents = valid.budgetCents;
  if (valid.constraints !== undefined) columns.constraints = valid.constraints;

  const draft = await getOrCreateOpenDraft(client, userId);
  if (Object.keys(columns).length === 0) return draft;

  const { data, error } = await client
    .from("booking_drafts")
    .update(columns)
    .eq("id", draft.id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update draft: ${error.message}`);
  return mapDraft(data);
}

/** Abandons open drafts untouched for a day. Returns how many. */
export async function abandonStaleDrafts(client: SupabaseClient, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_DRAFT_HOURS * 3_600_000).toISOString();
  const { data, error } = await client
    .from("booking_drafts")
    .update({ status: "abandoned" })
    .eq("status", "open")
    .lt("updated_at", cutoff)
    .select("id");
  if (error) throw new Error(`Failed to abandon stale drafts: ${error.message}`);
  return data?.length ?? 0;
}
