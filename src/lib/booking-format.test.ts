import { describe, expect, it } from "vitest";
import { clockTime, dateTime, money, slotDay } from "./booking-format";

describe("slotDay", () => {
  it("reads a slot's calendar date as weekday, day and short month (U03)", () => {
    const es = slotDay("2026-10-24", "es");
    expect(es).toMatch(/s[áa]b/i);
    expect(es).toContain("24");
    expect(es).toMatch(/oct/i);
    expect(es).not.toContain("2026");
  });

  it("follows the visitor's locale", () => {
    expect(slotDay("2026-10-24", "en")).toBe("Sat, Oct 24");
  });

  it("never shifts the day around a daylight-saving change", () => {
    // Spain leaves summer time on 2026-10-25.
    expect(slotDay("2026-10-25", "en")).toBe("Sun, Oct 25");
    expect(slotDay("2026-03-29", "en")).toBe("Sun, Mar 29");
  });

  it("returns anything that is not a date unchanged rather than 'Invalid Date'", () => {
    expect(slotDay("mañana", "es")).toBe("mañana");
    expect(slotDay("", "es")).toBe("");
  });
});

describe("existing formatters (regression)", () => {
  it("money formats integer cents", () => {
    expect(money(4000, "EUR", "es")).toMatch(/^40,00\s€$/);
  });

  it("clockTime is Madrid time", () => {
    expect(clockTime("2026-10-24T08:00:00Z", "es")).toBe("10:00");
  });

  it("dateTime includes the day and the Madrid time", () => {
    const text = dateTime("2026-10-22T08:00:00Z", "es");
    expect(text).toContain("22");
    expect(text).toContain("10:00");
  });
});
