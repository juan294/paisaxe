import { describe, it, expect } from "vitest";
import { fetchAnthropicCosts, fetchAnthropicCostsByDay } from "./anthropic-costs";

/**
 * Anthropic cost functions are stubs that always return null / [].
 * The Anthropic Admin API requires a Teams/Enterprise plan which this
 * project does not use. These tests verify the stub contract so callers
 * can rely on the return types.
 */
describe("anthropic-costs", () => {
  describe("fetchAnthropicCosts", () => {
    it("always returns null (Admin API unavailable on personal accounts)", async () => {
      const result = await fetchAnthropicCosts("2024-01-01", "2024-01-31");
      expect(result).toBeNull();
    });
  });

  describe("fetchAnthropicCostsByDay", () => {
    it("always returns empty array (Admin API unavailable on personal accounts)", async () => {
      const result = await fetchAnthropicCostsByDay("2024-01-01", "2024-01-31");
      expect(result).toEqual([]);
    });

});
});
