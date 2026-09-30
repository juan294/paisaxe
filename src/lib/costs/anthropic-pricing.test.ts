import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }));

import { getModelPricing, estimateCostUsd } from "./anthropic-pricing";

// Expected rates: https://platform.claude.com/docs/en/about-claude/pricing
// (retrieved 2026-09-30).
const perM = (usd: number) => usd / 1_000_000;

describe("anthropic-pricing", () => {
  beforeEach(() => {
    mockWarn.mockClear();
  });

  describe("getModelPricing", () => {
    it("matches a sonnet-5 model id at $2/$10", () => {
      const p = getModelPricing("claude-sonnet-5");
      expect(p.input).toBeCloseTo(perM(2), 12);
      expect(p.output).toBeCloseTo(perM(10), 12);
    });

    it("matches sonnet-5-5 at $2/$10", () => {
      const p = getModelPricing("claude-sonnet-5-5");
      expect(p.input).toBeCloseTo(perM(2), 12);
      expect(p.output).toBeCloseTo(perM(10), 12);
    });

    it("matches a legacy sonnet-4 model id with a date suffix", () => {
      const p = getModelPricing("claude-sonnet-4-6");
      expect(p.input).toBeCloseTo(perM(3), 12);
      expect(p.output).toBeCloseTo(perM(15), 12);
    });

    it("matches opus 4.5-4.8 pricing", () => {
      const p = getModelPricing("claude-opus-4-8");
      expect(p.input).toBeCloseTo(perM(5), 12);
      expect(p.output).toBeCloseTo(perM(25), 12);
    });

    it.each(["claude-opus-4-1", "claude-opus-4-1-20250805", "claude-opus-4-0", "claude-opus-4-20250514"])(
      "prices retired Opus 4 / 4.1 id %s at 15/75 USD per MTok",
      (model) => {
        const p = getModelPricing(model);
        expect(p.input).toBeCloseTo(perM(15), 12);
        expect(p.output).toBeCloseTo(perM(75), 12);
      }
    );

    it("matches opus-5 at $5/$25 with the standard 0.1x cache read", () => {
      const p = getModelPricing("claude-opus-5");
      expect(p.input).toBeCloseTo(perM(5), 12);
      expect(p.output).toBeCloseTo(perM(25), 12);
      expect(p.cacheRead).toBeCloseTo(perM(0.5), 12);
    });

    it("matches opus-5-5 at $4/$20 with its 0.05x cache read", () => {
      const p = getModelPricing("claude-opus-5-5");
      expect(p.input).toBeCloseTo(perM(4), 12);
      expect(p.output).toBeCloseTo(perM(20), 12);
      expect(p.cacheWrite).toBeCloseTo(perM(5), 12);
      expect(p.cacheRead).toBeCloseTo(perM(0.2), 12);
    });

    it.each(["claude-fable-5-1", "claude-mythos-5-1"])(
      "prices %s at 10/50 USD per MTok with its 0.025x cache read",
      (model) => {
        const p = getModelPricing(model);
        expect(p.input).toBeCloseTo(perM(10), 12);
        expect(p.output).toBeCloseTo(perM(50), 12);
        expect(p.cacheWrite).toBeCloseTo(perM(12.5), 12);
        expect(p.cacheRead).toBeCloseTo(perM(0.25), 12);
      }
    );

    it.each(["claude-fable-5", "claude-mythos-5"])(
      "prices %s at 10/50 USD per MTok with the standard 0.1x cache read",
      (model) => {
        const p = getModelPricing(model);
        expect(p.input).toBeCloseTo(perM(10), 12);
        expect(p.output).toBeCloseTo(perM(50), 12);
        expect(p.cacheRead).toBeCloseTo(perM(1), 12);
      }
    );

    it("matches haiku 4.5 at $1/$5", () => {
      const p = getModelPricing("claude-haiku-4-5");
      expect(p.input).toBeCloseTo(perM(1), 12);
      expect(p.output).toBeCloseTo(perM(5), 12);
    });

    it("falls back to the chat model's tier (Sonnet 5) for an unknown model", () => {
      const p = getModelPricing("some-future-model");
      expect(p.input).toBeCloseTo(perM(2), 12);
      expect(p.output).toBeCloseTo(perM(10), 12);
    });

    // An unpriced model is silently billed at the Sonnet 5 rate; warn once per
    // model so the table gets updated without flooding the logs.
    it("warns once per unknown model when the default pricing is used", () => {
      getModelPricing("claude-unlisted-9");
      getModelPricing("claude-unlisted-9");
      getModelPricing("claude-unlisted-10");

      expect(mockWarn).toHaveBeenCalledTimes(2);
      expect(mockWarn).toHaveBeenNthCalledWith(1, "[ANTHROPIC_PRICING_UNKNOWN_MODEL]", {
        model: "claude-unlisted-9",
      });
      expect(mockWarn).toHaveBeenNthCalledWith(2, "[ANTHROPIC_PRICING_UNKNOWN_MODEL]", {
        model: "claude-unlisted-10",
      });
    });

    it("does not warn for a priced model", () => {
      getModelPricing("claude-sonnet-5");
      getModelPricing("claude-fable-5-1");
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("derives cache rates from the input rate", () => {
      const p = getModelPricing("claude-sonnet-5");
      expect(p.cacheWrite).toBeCloseTo(p.input * 1.25, 12);
      expect(p.cacheRead).toBeCloseTo(p.input * 0.1, 12);
      // Published Sonnet 5 rows: 5m cache write $2.50, cache hit $0.20.
      expect(p.cacheWrite).toBeCloseTo(perM(2.5), 12);
      expect(p.cacheRead).toBeCloseTo(perM(0.2), 12);
    });
  });

  describe("estimateCostUsd", () => {
    it("computes input + output cost for sonnet-5", () => {
      // 1M input @ $2 + 1M output @ $10 = $12
      const cost = estimateCostUsd("claude-sonnet-5", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      });
      expect(cost).toBeCloseTo(12, 6);
    });

    it("includes cache tokens", () => {
      const cost = estimateCostUsd("claude-sonnet-5", {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 1_000_000, // 0.1x of $2 = $0.20
        cacheCreationInputTokens: 1_000_000, // 1.25x of $2 = $2.50
      });
      expect(cost).toBeCloseTo(0.2 + 2.5, 6);
    });

    it("treats negative/NaN token counts as zero", () => {
      const cost = estimateCostUsd("claude-sonnet-5", {
        inputTokens: -5,
        outputTokens: Number.NaN as unknown as number,
      });
      expect(cost).toBe(0);
    });
  });
});
