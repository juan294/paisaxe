import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal chainable stand-in for the Supabase query builder, used by the
 * src/lib/booking unit tests. Every builder method returns the same query and
 * records its arguments; awaiting the query resolves to the queued result.
 *
 * Results are queued per table (`from`) or per function (`rpc`) and consumed
 * in call order, so a test states exactly which reads and writes it expects.
 */
interface FakeResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

const BUILDER_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "eq",
  "neq",
  "in",
  "is",
  "not",
  "or",
  "lt",
  "lte",
  "gt",
  "gte",
  "order",
  "limit",
  "maybeSingle",
  "single",
] as const;

type BuilderMethod = (typeof BUILDER_METHODS)[number];

export type FakeQuery = { [K in BuilderMethod]: ReturnType<typeof vi.fn> } & PromiseLike<FakeResult>;

function fakeQuery(result: FakeResult): FakeQuery {
  const query = {} as FakeQuery;
  for (const method of BUILDER_METHODS) {
    query[method] = vi.fn(() => query);
  }
  const settled = { data: result.data ?? null, error: result.error ?? null };
  (query as { then: PromiseLike<FakeResult>["then"] }).then = (onFulfilled, onRejected) =>
    Promise.resolve(settled).then(onFulfilled, onRejected);
  return query;
}

export interface BookingSupabaseFake {
  client: SupabaseClient;
  /** Queue the result of the next `from(table)` query. Returns the query for assertions. */
  onTable(table: string, result: FakeResult): FakeQuery;
  /** Queue the result of the next `rpc(fn)` call (chainable like a query, e.g. `.single()`). Returns it for assertions. */
  onRpc(fn: string, result: FakeResult): FakeQuery;
  rpc: ReturnType<typeof vi.fn>;
}

export function createBookingSupabaseFake(): BookingSupabaseFake {
  const tables = new Map<string, FakeQuery[]>();
  const rpcs = new Map<string, FakeQuery[]>();

  const from = vi.fn((table: string) => {
    const next = tables.get(table)?.shift();
    if (!next) throw new Error(`unexpected query on ${table}`);
    return next;
  });

  const rpc = vi.fn((fn: string) => {
    const next = rpcs.get(fn)?.shift();
    if (!next) throw new Error(`unexpected rpc ${fn}`);
    return next;
  });

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    rpc,
    onTable(table, result) {
      const query = fakeQuery(result);
      tables.set(table, [...(tables.get(table) ?? []), query]);
      return query;
    },
    onRpc(fn, result) {
      const query = fakeQuery(result);
      rpcs.set(fn, [...(rpcs.get(fn) ?? []), query]);
      return query;
    },
  };
}

/** A `bookings` row as PostgREST returns it. */
export function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    reference: "RS-ABC123",
    user_id: "user-1",
    quote_id: "quote-1",
    experience_id: "exp-1",
    slot_date: "2026-11-21",
    slot_time: "10:00:00",
    party_size: 4,
    total_cents: 12000,
    deposit_cents: 3000,
    currency: "EUR",
    cancellation_window_hours: 24,
    status: "pending_payment",
    confirmed_at: null,
    link_version: 1,
    ...overrides,
  };
}

/** An `experiences` row as PostgREST returns it, without embedded relations. */
export function experienceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    merchant_id: "m1",
    slug: "walk",
    title: "Walk",
    description: null,
    currency: "EUR",
    price_cents: 12000,
    deposit_cents: 3000,
    max_party: 6,
    capacity_per_slot: 12,
    slot_rule: { weekdays: [1, 2, 3, 4, 5, 6, 7], start_times: ["10:00", "16:00"] },
    duration_minutes: 150,
    ...overrides,
  };
}
