import { describe, it, expect } from "vitest";
import { computeForecasts } from "./forecast";
import type { ServiceCost, UsageMetrics } from "@/types/costs-analytics";

const mockUsage: UsageMetrics = {
  visitors: 300,
  chatConversations: 50,
  voiceConversations: 10,
  voiceMinutes: 25,
  periodDays: 15,
};

const mockServices: ServiceCost[] = [
  {
    serviceId: "supabase",
    serviceName: "Supabase",
    category: "infrastructure",
    costUsd: 25,
    costFormatted: "$25.00",
    source: "recurring",
    billingPeriodStart: "2026-02-01",
    billingPeriodEnd: "2026-02-15",
  },
  {
    serviceId: "elevenlabs",
    serviceName: "ElevenLabs",
    category: "ai",
    costUsd: 5,
    costFormatted: "$5.00",
    source: "recurring",
    billingPeriodStart: "2026-02-01",
    billingPeriodEnd: "2026-02-15",
  },
  {
    serviceId: "anthropic",
    serviceName: "Anthropic Claude",
    category: "ai",
    costUsd: 3,
    costFormatted: "$3.00",
    source: "api",
    billingPeriodStart: "2026-02-01",
    billingPeriodEnd: "2026-02-15",
  },
  {
    serviceId: "elevenlabs",
    serviceName: "ElevenLabs",
    category: "ai",
    costUsd: 2,
    costFormatted: "$2.00",
    source: "estimate",
    billingPeriodStart: "2026-02-01",
    billingPeriodEnd: "2026-02-15",
  },
];

describe("computeForecasts", () => {
  it("should return three scenarios by default", () => {
    const forecasts = computeForecasts(mockServices, mockUsage);
    expect(forecasts).toHaveLength(3);
    expect(forecasts[0].label).toBe("Current");
    expect(forecasts[1].label).toBe("3x Growth");
    expect(forecasts[2].label).toBe("10x Growth");
  });

  it("should keep infrastructure costs constant across multipliers", () => {
    const forecasts = computeForecasts(mockServices, mockUsage);
    const fixedCost = 30; // $25 + $5 recurring

    expect(forecasts[0].breakdown.infrastructure).toBe(fixedCost);
    expect(forecasts[1].breakdown.infrastructure).toBe(fixedCost);
    expect(forecasts[2].breakdown.infrastructure).toBe(fixedCost);
  });

  it("should scale AI costs linearly", () => {
    const forecasts = computeForecasts(mockServices, mockUsage);

    const currentAi = forecasts[0].breakdown.ai;
    expect(forecasts[1].breakdown.ai).toBeCloseTo(currentAi * 3, 1);
    expect(forecasts[2].breakdown.ai).toBeCloseTo(currentAi * 10, 1);
  });

  it("should scale voice costs linearly", () => {
    const forecasts = computeForecasts(mockServices, mockUsage);

    const currentVoice = forecasts[0].breakdown.voice;
    expect(forecasts[1].breakdown.voice).toBeCloseTo(currentVoice * 3, 1);
    expect(forecasts[2].breakdown.voice).toBeCloseTo(currentVoice * 10, 1);
  });

  it("should normalize partial-period data to 30 days", () => {
    const forecasts = computeForecasts(mockServices, mockUsage);

    // 300 visitors in 15 days → 600/month
    expect(forecasts[0].visitors).toBe(600);
    // 50 chats in 15 days → 100/month
    expect(forecasts[0].chats).toBe(100);
    // 25 voice minutes in 15 days → 50/month
    expect(forecasts[0].voiceMinutes).toBe(50);
  });

  it("should scale visitors with multiplier", () => {
    const forecasts = computeForecasts(mockServices, mockUsage);

    expect(forecasts[1].visitors).toBe(forecasts[0].visitors * 3);
    expect(forecasts[2].visitors).toBe(forecasts[0].visitors * 10);
  });

  it("should use fallback rates when usage is zero", () => {
    const zeroUsage: UsageMetrics = {
      visitors: 0,
      chatConversations: 0,
      voiceConversations: 0,
      voiceMinutes: 0,
      periodDays: 30,
    };

    const forecasts = computeForecasts(mockServices, zeroUsage);

    // With zero usage, all variable costs should be 0 (even with fallback rates, 0 * rate = 0)
    expect(forecasts[0].breakdown.ai).toBe(0);
    expect(forecasts[0].breakdown.voice).toBe(0);
    // But infrastructure should still be there
    expect(forecasts[0].breakdown.infrastructure).toBe(30);
  });

  it("should accept custom multipliers", () => {
    const forecasts = computeForecasts(mockServices, mockUsage, [1, 5, 20]);

    expect(forecasts).toHaveLength(3);
    expect(forecasts[0].multiplier).toBe(1);
    expect(forecasts[1].multiplier).toBe(5);
    expect(forecasts[2].multiplier).toBe(20);
  });

  it("should compute total cost as sum of breakdown", () => {
    const forecasts = computeForecasts(mockServices, mockUsage);

    for (const forecast of forecasts) {
      const sum =
        forecast.breakdown.infrastructure +
        forecast.breakdown.ai +
        forecast.breakdown.voice;
      expect(forecast.estimatedMonthlyCost).toBeCloseTo(sum, 1);
    }
  });

  it("should handle periodDays of 0 gracefully", () => {
    const zeroDay: UsageMetrics = {
      ...mockUsage,
      periodDays: 0,
    };

    // Should not throw
    const forecasts = computeForecasts(mockServices, zeroDay);
    expect(forecasts).toHaveLength(3);
  });
});
