// @vitest-environment node
import { describe, expect, it } from "vitest";
import { centsToValue, valueToCents } from "./money";
import { PaypalError } from "./types";

describe("centsToValue", () => {
  it.each([
    [3000, "30.00"],
    [5, "0.05"],
    [1999, "19.99"],
    [100_000, "1000.00"],
  ])("formats %i cents as %s", (cents, value) => {
    expect(centsToValue(cents)).toBe(value);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects %s",
    (cents) => {
      expect(() => centsToValue(cents)).toThrow(RangeError);
    },
  );
});

describe("valueToCents", () => {
  it.each([
    ["30.00", 3000],
    ["30", 3000],
    ["30.5", 3050],
    ["0.05", 5],
    ["1000.00", 100_000],
  ])("parses %s as %i cents", (value, cents) => {
    expect(valueToCents(value)).toBe(cents);
  });

  it.each(["", "30.005", "-1.00", "abc", "1e3", " 30.00", "30,00", "99999999999999999.00"])(
    "rejects %j as an unreadable PayPal amount",
    (value) => {
      expect(() => valueToCents(value)).toThrow(PaypalError);
    },
  );
});
