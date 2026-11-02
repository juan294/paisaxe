// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createBookingEvalClock } from "./booking-eval-clock";

const SOURCE = "2026-10-28T10:00:00Z";
const DAY = 24 * 60 * 60 * 1000;

describe("local booking evaluation clock", () => {
  it("moves expired November 1 slots forward by a whole week", () => {
    const wall = new Date("2026-11-01T19:00:00Z");
    const clock = createBookingEvalClock(SOURCE, wall);
    expect(clock.sourceClock).toBe(SOURCE);
    expect(clock.dateShiftDays).toBe(7);
    expect(clock.executionClock).toBe("2026-11-04T10:00:00.000Z");
    expect(Date.parse(clock.executionClock)).toBeGreaterThanOrEqual(wall.getTime() + DAY);
    expect(clock.shiftDate("2026-11-01")).toBe("2026-11-08");
    expect(Date.parse(clock.shiftDate("2026-11-01") + "T10:00:00Z")).toBeGreaterThan(wall.getTime());
  });

  it("keeps future slots and weekdays aligned across later calendar years", () => {
    const wall = new Date("2027-01-01T19:00:00Z");
    const clock = createBookingEvalClock(SOURCE, wall);
    expect(clock.dateShiftDays % 7).toBe(0);
    expect(Date.parse(clock.executionClock)).toBeGreaterThanOrEqual(wall.getTime() + DAY);
    // The preceding whole-week choice would not provide the required margin.
    expect(Date.parse(clock.executionClock) - 7 * DAY).toBeLessThan(wall.getTime() + DAY);
    for (const date of ["2026-11-01", "2026-11-07", "2026-11-30"]) {
      const shifted = clock.shiftDate(date);
      expect(new Date(shifted).getUTCDay()).toBe(new Date(date).getUTCDay());
      expect(Date.parse(shifted + "T10:00:00Z")).toBeGreaterThan(wall.getTime());
    }
  });

  it("shifts only serialized user dates, leaving source and returned assistant text unchanged", () => {
    const clock = createBookingEvalClock(SOURCE, new Date("2026-11-01T19:00:00Z"));
    const history = Object.freeze([
      Object.freeze({ role: "user" as const, content: "Para 2 personas el 2026-11-01 hasta 120 euros." }),
      Object.freeze({ role: "assistant" as const, content: "Oferta para 2026-11-08 a las 10:00, 120 euros." }),
    ]);
    const message = "Quiero la opción el 2026-11-01 a las 10:00 para 2 personas.";
    const expected = {
      message: "Quiero la opción el 2026-11-08 a las 10:00 para 2 personas.",
      history: [
        { role: "user", content: "Para 2 personas el 2026-11-08 hasta 120 euros." },
        { role: "assistant", content: history[1]!.content },
      ],
    };
    expect(clock.shiftUserInput(message, history)).toEqual(expected);
    expect(clock.shiftUserInput(message, history)).toEqual(expected);
    expect(history[0]!.content).toContain("2026-11-01");
    expect(message).toContain("2026-11-01");
    expect(clock.shiftUserInput("Mañana a las 16:00 para 4 personas, 60 euros.").message)
      .toBe("Mañana a las 16:00 para 4 personas, 60 euros.");
  });

  it("uses zero offset when the source clock already has the full margin", () => {
    const clock = createBookingEvalClock(SOURCE, new Date("2026-10-27T10:00:00Z"));
    expect(clock.dateShiftDays).toBe(0);
    expect(Date.parse(clock.executionClock)).toBe(Date.parse(SOURCE));
    expect(clock.shiftDate("2026-11-01")).toBe("2026-11-01");
    expect(clock.shiftUserInput("2026-11-01: 2 personas, 120 euros")).toEqual({
      message: "2026-11-01: 2 personas, 120 euros", history: [],
    });
  });
});
