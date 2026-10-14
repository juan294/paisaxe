import { describe, expect, it } from "vitest";
import { isTimeoutError } from "./is-timeout-error";

describe("isTimeoutError", () => {
  it.each(["AbortError", "TimeoutError"])("recognizes %s across error shapes", (name) => {
    expect(isTimeoutError(new DOMException("operation stopped", name))).toBe(true);
    expect(isTimeoutError(Object.assign(new Error("operation stopped"), { name }))).toBe(true);
    expect(isTimeoutError({ name })).toBe(true);
    expect(isTimeoutError(Object.assign(Object.create(null), { name }))).toBe(true);
  });

  it.each([
    undefined,
    null,
    false,
    0,
    "TimeoutError",
    Symbol("AbortError"),
    {},
    { name: undefined },
    { name: 23 },
    { name: "Error", message: "TimeoutError" },
    { name: "RPC_TIMEOUT" },
    { name: "timeoutError" },
    { name: "AbortError " },
    new Error("The request timed out"),
  ])("[case %#] does not infer timeout from an unrelated unknown value (%j)", (error) => {
    expect(isTimeoutError(error)).toBe(false);
  });

  it("does not mutate an error-shaped value", () => {
    const error = Object.freeze({ name: "TimeoutError", message: "stopped" });
    expect(isTimeoutError(error)).toBe(true);
    expect(error).toEqual({ name: "TimeoutError", message: "stopped" });
  });
});
