import { describe, expect, it } from "vitest";
import { createBookingSupabaseFake, experienceRow, type BookingSupabaseFake } from "@/test/booking-supabase-fake";
import { listAvailability, searchExperiences } from "./availability";

const NOW = new Date("2026-11-20T09:00:00Z");

function experience(slug: string, overrides: Record<string, unknown> = {}, facts: Record<string, unknown>[] = []) {
  return experienceRow({ id: `id-${slug}`, slug, title: slug, duration_minutes: 120, experience_facts: facts, ...overrides });
}

const stepFree = (value: "yes" | "no" | "unknown") => ({
  key: "step_free",
  value,
  detail: `step_free ${value}`,
  data: {},
  confirmed_by_provider: value !== "unknown",
});

function slots(ten: number, sixteen: number) {
  return { data: [{ start_time: "10:00:00", available: ten }, { start_time: "16:00:00", available: sixteen }] };
}

function queueDays(fake: BookingSupabaseFake, days: number, ten = 12, sixteen = 12) {
  for (let i = 0; i < days; i++) fake.onRpc("experience_availability", slots(ten, sixteen));
}

describe("listAvailability", () => {
  it("asks the database for each day and returns places per start time", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("experience_availability", slots(12, 4));
    fake.onRpc("experience_availability", slots(0, 8));

    const result = await listAvailability(fake.client, "exp-1", "2026-11-21", 2);

    expect(fake.rpc).toHaveBeenNthCalledWith(1, "experience_availability", {
      p_experience_id: "exp-1",
      p_date: "2026-11-21",
    });
    expect(fake.rpc).toHaveBeenNthCalledWith(2, "experience_availability", {
      p_experience_id: "exp-1",
      p_date: "2026-11-22",
    });
    expect(result).toEqual([
      { date: "2026-11-21", startTime: "10:00", available: 12 },
      { date: "2026-11-21", startTime: "16:00", available: 4 },
      { date: "2026-11-22", startTime: "10:00", available: 0 },
      { date: "2026-11-22", startTime: "16:00", available: 8 },
    ]);
  });

  it("caps the window at 31 days", async () => {
    const fake = createBookingSupabaseFake();
    queueDays(fake, 31);
    await listAvailability(fake.client, "exp-1", "2026-11-21", 400);
    expect(fake.rpc).toHaveBeenCalledTimes(31);
  });

  it("throws when the database call fails", async () => {
    const fake = createBookingSupabaseFake();
    fake.onRpc("experience_availability", { error: { message: "down" } });
    await expect(listAvailability(fake.client, "exp-1", "2026-11-21", 1)).rejects.toThrow(/down/);
  });
});

describe("searchExperiences", () => {
  it("returns unsuitable options as rejected with a reason instead of dropping them (F07)", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("experiences", {
      data: [
        experience("walk", {}, [stepFree("yes")]),
        experience("canoe", { price_cents: 6000, deposit_cents: 1500, max_party: 4 }, [stepFree("no")]),
        experience("jeep", { price_cents: 20000, deposit_cents: 5000 }, [stepFree("unknown")]),
      ],
    });
    fake.onRpc("experience_availability", slots(12, 12));

    const results = await searchExperiences(
      fake.client,
      { partySize: 4, date: "2026-11-21", budgetCents: 12000, constraints: { step_free: true } },
      NOW
    );

    expect(results.map((r) => [r.experience.slug, r.suitability, r.reasons])).toEqual([
      ["walk", "suitable", []],
      ["canoe", "rejected", ["constraint_unsupported"]],
      ["jeep", "rejected", ["over_budget"]],
    ]);
    expect(results[0].slots).toEqual([
      { date: "2026-11-21", startTime: "10:00", available: 12 },
      { date: "2026-11-21", startTime: "16:00", available: 12 },
    ]);
    // Rejected options cost no availability lookups.
    expect(fake.rpc).toHaveBeenCalledTimes(1);
    expect(results[2].verdicts).toEqual([
      { key: "step_free", verdict: "unknown", detail: "step_free unknown", confirmedByProvider: false },
    ]);
  });

  it("offers an option with an unknown fact as unconfirmed, never as suitable", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("experiences", { data: [experience("jeep", {}, [stepFree("unknown")])] });
    fake.onRpc("experience_availability", slots(12, 12));

    const [result] = await searchExperiences(
      fake.client,
      { partySize: 2, date: "2026-11-21", constraints: { step_free: true } },
      NOW
    );
    expect(result.suitability).toBe("unconfirmed");
  });

  it("rejects a party larger than the experience allows", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("experiences", { data: [experience("canoe", { max_party: 4 })] });

    const [result] = await searchExperiences(fake.client, { partySize: 5, date: "2026-11-21" }, NOW);
    expect(result.reasons).toEqual(["party_too_large"]);
  });

  it("keeps only slots with room for the party, and offers the following days when the date is full", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("experiences", { data: [experience("walk")] });
    fake.onRpc("experience_availability", slots(3, 0)); // requested date: no room for 4
    fake.onRpc("experience_availability", slots(0, 4)); // +1 day
    queueDays(fake, 6, 0, 0); // +2..+7

    const [result] = await searchExperiences(fake.client, { partySize: 4, date: "2026-11-21" }, NOW);

    expect(result.suitability).toBe("rejected");
    expect(result.reasons).toEqual(["no_availability"]);
    expect(result.slots).toEqual([]);
    expect(result.alternatives).toEqual([{ date: "2026-11-22", startTime: "16:00", available: 4 }]);
    expect(fake.rpc).toHaveBeenNthCalledWith(2, "experience_availability", {
      p_experience_id: "id-walk",
      p_date: "2026-11-22",
    });
  });

  it("without a date, looks at the next seven days from today in Madrid", async () => {
    const fake = createBookingSupabaseFake();
    fake.onTable("experiences", { data: [experience("walk")] });
    queueDays(fake, 7);

    const [result] = await searchExperiences(fake.client, {}, NOW);

    expect(fake.rpc).toHaveBeenCalledTimes(7);
    expect(fake.rpc).toHaveBeenNthCalledWith(1, "experience_availability", {
      p_experience_id: "id-walk",
      p_date: "2026-11-20",
    });
    expect(result.suitability).toBe("suitable");
    expect(result.slots).toHaveLength(14);
  });

  it("reads only active experiences, with their facts", async () => {
    const fake = createBookingSupabaseFake();
    const query = fake.onTable("experiences", { data: [] });

    expect(await searchExperiences(fake.client, {}, NOW)).toEqual([]);
    expect(query.select).toHaveBeenCalledWith("*, experience_facts(*)");
    expect(query.eq).toHaveBeenCalledWith("active", true);
  });
});
