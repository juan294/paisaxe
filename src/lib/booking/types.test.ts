// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES, FACT_KEYS, mapExperience, mapQuote, toHhMm } from "./types";

const schemaSql = readFileSync(
  join(process.cwd(), "supabase/migrations/112_experience_booking_schema.sql"),
  "utf8"
);

/** The quoted values of the CHECK (<column> IN (...)) inside a CREATE TABLE block. */
function checkValues(table: string, column: string): string[] {
  const block = schemaSql.slice(schemaSql.indexOf(`CREATE TABLE public.${table} (`));
  const match = new RegExp(`${column}[^;]*?CHECK \\(${column} IN \\(([^)]*)\\)`).exec(block);
  if (!match) throw new Error(`no CHECK for ${table}.${column}`);
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe("status and key lists match the migration CHECK constraints", () => {
  it("bookings.status", () => {
    expect(checkValues("bookings", "status")).toEqual([...BOOKING_STATUSES]);
  });

  it("experience_facts.key", () => {
    expect(checkValues("experience_facts", "key")).toEqual([...FACT_KEYS]);
  });
});

describe("row mappers", () => {
  it("derives the balance from total and deposit, and trims seconds from times", () => {
    const quote = mapQuote({
      id: "q",
      draft_id: null,
      experience_id: "e",
      version: 1,
      slot_date: "2026-11-21",
      slot_time: "16:00:00",
      party_size: 4,
      total_cents: 20000,
      deposit_cents: 5000,
      currency: "EUR",
      cancellation_window_hours: 24,
      expires_at: "2026-11-20T09:20:00Z",
    });
    expect(quote.balanceCents).toBe(15000);
    expect(quote.slotTime).toBe("16:00");
    expect(toHhMm("10:00")).toBe("10:00");
  });

  it("maps an experience with its slot rule and facts", () => {
    const experience = mapExperience({
      id: "e",
      merchant_id: "m",
      slug: "walk",
      title: "Walk",
      description: null,
      currency: "EUR",
      price_cents: 12000,
      deposit_cents: 3000,
      max_party: 6,
      capacity_per_slot: 12,
      slot_rule: { weekdays: [6, 7], start_times: ["10:00"] },
      duration_minutes: null,
      experience_facts: [
        { key: "step_free", value: "yes", detail: "Llano", data: null, confirmed_by_provider: true },
      ],
    });
    expect(experience.slotRule).toEqual({ weekdays: [6, 7], startTimes: ["10:00"] });
    expect(experience.facts).toEqual([
      { key: "step_free", value: "yes", detail: "Llano", data: {}, confirmedByProvider: true },
    ]);
  });
});
