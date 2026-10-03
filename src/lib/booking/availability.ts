/**
 * Availability and experience search over the booking catalog.
 *
 * Places left per slot come from public.experience_availability (migration
 * 113), the single definition of "capacity minus confirmed bookings minus
 * live holds" (F04). searchExperiences returns every active experience with
 * its constraint verdicts, so an unsuitable option is reported as rejected
 * with a reason rather than silently dropped (F07).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateConstraints, type ConstraintVerdict, type VisitorConstraints } from "./facts";
import { addDays, madridDate, mapExperience, toHhMm, type Experience } from "./types";

const MAX_WINDOW_DAYS = 31;
/** Days searched when no date is given, and alternatives offered when a date is full. */
const SEARCH_WINDOW_DAYS = 7;

export interface SlotAvailability {
  date: string;
  /** "HH:MM" in the merchant's timezone. */
  startTime: string;
  available: number;
}

type RejectionReason = "over_budget" | "party_too_large" | "constraint_unsupported" | "no_availability";

export interface SearchResult {
  experience: Experience;
  verdicts: ConstraintVerdict[];
  /** "unconfirmed": offerable only with an explicit not-confirmed notice. */
  suitability: "suitable" | "unconfirmed" | "rejected";
  reasons: RejectionReason[];
  /** Slots with room for the party on the requested date (or the next seven days). */
  slots: SlotAvailability[];
  /** When the requested date is full: slots with room in the following seven days. */
  alternatives: SlotAvailability[];
}

interface SearchInput {
  partySize?: number | null;
  date?: string | null;
  budgetCents?: number | null;
  constraints?: VisitorConstraints;
}

export async function listAvailability(
  client: SupabaseClient,
  experienceId: string,
  fromDate: string,
  days: number
): Promise<SlotAvailability[]> {
  const count = Math.min(Math.max(Math.trunc(days), 1), MAX_WINDOW_DAYS);
  const dates = Array.from({ length: count }, (_, i) => addDays(fromDate, i));

  const perDay = await Promise.all(
    dates.map(async (date) => {
      const { data, error } = await client.rpc("experience_availability", {
        p_experience_id: experienceId,
        p_date: date,
      });
      if (error) throw new Error(`Failed to read availability: ${error.message}`);
      return ((data ?? []) as { start_time: string; available: number }[]).map((row) => ({
        date,
        startTime: toHhMm(row.start_time),
        available: row.available,
      }));
    })
  );
  return perDay.flat();
}

function staticReasons(experience: Experience, input: SearchInput, verdicts: ConstraintVerdict[]): RejectionReason[] {
  const reasons: RejectionReason[] = [];
  if (input.budgetCents != null && experience.priceCents > input.budgetCents) reasons.push("over_budget");
  if (input.partySize != null && input.partySize > experience.maxParty) reasons.push("party_too_large");
  if (verdicts.some((v) => v.verdict === "unsupported")) reasons.push("constraint_unsupported");
  return reasons;
}

const SUITABILITY_ORDER = { suitable: 0, unconfirmed: 1, rejected: 2 } as const;

export async function searchExperiences(
  client: SupabaseClient,
  input: SearchInput,
  now: Date = new Date()
): Promise<SearchResult[]> {
  const { data, error } = await client
    .from("experiences")
    .select("*, experience_facts(*)")
    .eq("active", true)
    .order("price_cents");
  if (error) throw new Error(`Failed to load experiences: ${error.message}`);

  const party = input.partySize ?? 1;
  const hasRoom = (slot: SlotAvailability) => slot.available >= party;

  const results = await Promise.all(
    (data ?? []).map(async (row): Promise<SearchResult> => {
      const experience = mapExperience(row);
      const verdicts = evaluateConstraints(experience, input.constraints ?? {});
      const reasons = staticReasons(experience, input, verdicts);
      let slots: SlotAvailability[] = [];
      let alternatives: SlotAvailability[] = [];

      // Rejected options cost no availability lookups.
      if (reasons.length === 0) {
        const from = input.date ?? madridDate(now);
        slots = (await listAvailability(client, experience.id, from, input.date ? 1 : SEARCH_WINDOW_DAYS)).filter(hasRoom);
        if (slots.length === 0) {
          reasons.push("no_availability");
          if (input.date) {
            alternatives = (
              await listAvailability(client, experience.id, addDays(input.date, 1), SEARCH_WINDOW_DAYS)
            ).filter(hasRoom);
          }
        }
      }

      const suitability =
        reasons.length > 0 ? "rejected" : verdicts.some((v) => v.verdict === "unknown") ? "unconfirmed" : "suitable";
      return { experience, verdicts, suitability, reasons, slots, alternatives };
    })
  );

  return results.sort((a, b) => SUITABILITY_ORDER[a.suitability] - SUITABILITY_ORDER[b.suitability]);
}
