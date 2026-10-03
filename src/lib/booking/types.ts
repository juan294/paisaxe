/**
 * Booking domain types and row mappers (PayPal hackathon plan, Phase 1).
 *
 * The database is the authority (migrations 112-116). Rows are snake_case;
 * these mappers are the only place that knows the column names. Amounts are
 * integer cents.
 */
import { z } from "zod";

export const BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "cancel_pending",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
  "needs_attention",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const FACT_KEYS = [
  "step_free",
  "min_age",
  "languages",
  "public_transport",
  "pets_allowed",
  "equipment_included",
] as const;
export type FactKey = (typeof FACT_KEYS)[number];
type FactValue = "yes" | "no" | "unknown";

/** Minutes a quote stays acceptable after creation. */
export const QUOTE_TTL_MINUTES = 20;

/** Largest party any experience accepts (matches the DB CHECK). */
const MAX_PARTY_SIZE = 12;

/** Postgres unique_violation, as PostgREST reports it in `error.code`. */
export const UNIQUE_VIOLATION = "23505";

// Input shapes shared by drafts and quotes.
export const isoDateSchema = z.iso.date();
export const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const partySizeSchema = z.number().int().min(1).max(MAX_PARTY_SIZE);
const uuidSchema = z.guid();

export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

/** Parses input or throws BookingError("invalid_input") with the issue messages. */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BookingError("invalid_input", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

/** Calendar date "YYYY-MM-DD" in Madrid for an instant. */
export function madridDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);
}

/** Adds whole days to a "YYYY-MM-DD" date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type BookingErrorCode =
  | "not_found"
  | "not_owned"
  | "quote_expired"
  | "no_capacity"
  | "invalid_input";

export class BookingError extends Error {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode, message?: string) {
    super(message ?? code);
    this.name = "BookingError";
    this.code = code;
  }
}

interface SlotRule {
  /** ISO weekdays, 1 (Monday) to 7 (Sunday). */
  weekdays: number[];
  /** "HH:MM" in the merchant's timezone. */
  startTimes: string[];
}

export interface ExperienceFact {
  key: FactKey;
  value: FactValue;
  detail: string | null;
  data: Record<string, unknown>;
  confirmedByProvider: boolean;
}

export interface Experience {
  id: string;
  merchantId: string;
  slug: string;
  title: string;
  description: string | null;
  currency: string;
  /** Total price for one party, up to maxParty. */
  priceCents: number;
  depositCents: number;
  maxParty: number;
  capacityPerSlot: number;
  slotRule: SlotRule;
  durationMinutes: number | null;
  facts: ExperienceFact[];
}

export interface Quote {
  id: string;
  draftId: string | null;
  experienceId: string;
  version: number;
  slotDate: string;
  slotTime: string;
  partySize: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  currency: string;
  cancellationWindowHours: number;
  expiresAt: string;
}

export interface Booking {
  id: string;
  reference: string;
  userId: string | null;
  quoteId: string;
  experienceId: string;
  slotDate: string;
  slotTime: string;
  partySize: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  currency: string;
  cancellationWindowHours: number;
  status: BookingStatus;
  confirmedAt: string | null;
  linkVersion: number;
}

type Row = Record<string, unknown>;

/** "10:00:00" -> "10:00" */
export function toHhMm(time: string): string {
  return time.slice(0, 5);
}

function mapFact(row: Row): ExperienceFact {
  return {
    key: row.key as FactKey,
    value: row.value as FactValue,
    detail: (row.detail as string | null) ?? null,
    data: (row.data as Record<string, unknown> | null) ?? {},
    confirmedByProvider: row.confirmed_by_provider === true,
  };
}

export function mapExperience(row: Row): Experience {
  const rule = (row.slot_rule ?? {}) as { weekdays?: number[]; start_times?: string[] };
  return {
    id: row.id as string,
    merchantId: row.merchant_id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    currency: row.currency as string,
    priceCents: row.price_cents as number,
    depositCents: row.deposit_cents as number,
    maxParty: row.max_party as number,
    capacityPerSlot: row.capacity_per_slot as number,
    slotRule: { weekdays: rule.weekdays ?? [], startTimes: rule.start_times ?? [] },
    durationMinutes: (row.duration_minutes as number | null) ?? null,
    facts: ((row.experience_facts as Row[] | undefined) ?? []).map(mapFact),
  };
}

export function mapQuote(row: Row): Quote {
  const total = row.total_cents as number;
  const deposit = row.deposit_cents as number;
  return {
    id: row.id as string,
    draftId: (row.draft_id as string | null) ?? null,
    experienceId: row.experience_id as string,
    version: row.version as number,
    slotDate: row.slot_date as string,
    slotTime: toHhMm(row.slot_time as string),
    partySize: row.party_size as number,
    totalCents: total,
    depositCents: deposit,
    balanceCents: total - deposit,
    currency: row.currency as string,
    cancellationWindowHours: row.cancellation_window_hours as number,
    expiresAt: row.expires_at as string,
  };
}

export function mapBooking(row: Row): Booking {
  const total = row.total_cents as number;
  const deposit = row.deposit_cents as number;
  return {
    id: row.id as string,
    reference: row.reference as string,
    userId: (row.user_id as string | null) ?? null,
    quoteId: row.quote_id as string,
    experienceId: row.experience_id as string,
    slotDate: row.slot_date as string,
    slotTime: toHhMm(row.slot_time as string),
    partySize: row.party_size as number,
    totalCents: total,
    depositCents: deposit,
    balanceCents: total - deposit,
    currency: row.currency as string,
    cancellationWindowHours: row.cancellation_window_hours as number,
    status: row.status as BookingStatus,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    linkVersion: row.link_version as number,
  };
}
