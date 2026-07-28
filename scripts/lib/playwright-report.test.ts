// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertTestsExecuted } from "./playwright-report";

describe("assertTestsExecuted", () => {
  it("accepts a run in which tests actually passed", () => {
    expect(() =>
      assertTestsExecuted({ stats: { expected: 3, skipped: 1 } }, "stripe")
    ).not.toThrow();
  });

  it("accepts a run with failures — those are real results, reported elsewhere", () => {
    expect(() =>
      assertTestsExecuted({ stats: { expected: 0, unexpected: 2 } }, "stripe")
    ).not.toThrow();
  });

  it("rejects a run where every test was skipped", () => {
    expect(() =>
      assertTestsExecuted({ stats: { expected: 0, skipped: 7 } }, "stripe")
    ).toThrow(/zero tests executed \(7 skipped\)/);
  });

  it("rejects a run that selected nothing at all", () => {
    expect(() => assertTestsExecuted({ stats: {} }, "stripe")).toThrow(
      /zero tests executed/
    );
  });

  it("rejects a missing report rather than assuming success", () => {
    expect(() => assertTestsExecuted(undefined, "stripe")).toThrow(
      /no Playwright JSON report was produced/
    );
  });
});
