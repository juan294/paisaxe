import { describe, it, expect } from "vitest";
import { getModelPricing, estimateCostUsd } from "./anthropic-pricing";

describe("anthropic-pricing", () => {
  describe("getModelPricing", () => {
    it("matches a sonnet-4 model id with a date suffix", () => {
      const p = getModelPricing("claude-sonnet-4-20250514");
      expect(p.input).toBeCloseTo(3 / 1_000_000, 12);
      expect(p.output).toBeCloseTo(15 / 1_000_000, 12);
    });

    it("matches opus pricing", () => {
      const p = getModelPricing("claude-opus-4-8");
      expect(p.input).toBeCloseTo(5 / 1_000_000, 12);
      expect(p.output).toBeCloseTo(25 / 1_000_000, 12);
    });

    it("falls back to a default for an unknown model", () => {
      const p = getModelPricing("some-future-model");
      expect(p.input).toBeGreaterThan(0);
      expect(p.output).toBeGreaterThan(0);
    });

    it("derives cache rates from the input rate", () => {
      const p = getModelPricing("claude-sonnet-4-20250514");
      expect(p.cacheWrite).toBeCloseTo(p.input * 1.25, 12);
      expect(p.cacheRead).toBeCloseTo(p.input * 0.1, 12);
    });
  });

  describe("estimateCostUsd", () => {
    it("computes input + output cost for sonnet-4", () => {
      // 1M input @ $3 + 1M output @ $15 = $18
      const cost = estimateCostUsd("claude-sonnet-4-20250514", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      });
      expect(cost).toBeCloseTo(18, 6);
    });

    it("includes cache tokens", () => {
      const cost = estimateCostUsd("claude-sonnet-4-20250514", {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 1_000_000, // 0.1x of $3 = $0.30
        cacheCreationInputTokens: 1_000_000, // 1.25x of $3 = $3.75
      });
      expect(cost).toBeCloseTo(0.3 + 3.75, 6);
    });

    it("treats negative/NaN token counts as zero", () => {
      const cost = estimateCostUsd("claude-sonnet-4-20250514", {
        inputTokens: -5,
        outputTokens: Number.NaN as unknown as number,
      });
      expect(cost).toBe(0);
    });
  });
});
