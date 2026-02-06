import { describe, it, expect } from "vitest";
import { SERVICE_TIERS } from "./service-tiers";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";

describe("SERVICE_TIERS config", () => {
  const platformIds = Object.values(PLATFORM_SERVICES).map((s) => s.id);

  it("should have at least one tier configured", () => {
    expect(SERVICE_TIERS.length).toBeGreaterThan(0);
  });

  it("should have serviceIds matching PLATFORM_SERVICES", () => {
    for (const tier of SERVICE_TIERS) {
      expect(platformIds).toContain(tier.serviceId);
    }
  });

  it("should have positive monthly limits", () => {
    for (const tier of SERVICE_TIERS) {
      for (const limit of tier.limits) {
        expect(limit.monthlyLimit).toBeGreaterThan(0);
      }
    }
  });

  it("should have non-negative current tier costs", () => {
    for (const tier of SERVICE_TIERS) {
      expect(tier.currentMonthlyCostUsd).toBeGreaterThanOrEqual(0);
    }
  });

  it("should have next tier costing more than current tier when defined", () => {
    for (const tier of SERVICE_TIERS) {
      if (tier.nextTier) {
        expect(tier.nextTier.monthlyCostUsd).toBeGreaterThanOrEqual(
          tier.currentMonthlyCostUsd
        );
      }
    }
  });

  it("should have at least one limit per tier", () => {
    for (const tier of SERVICE_TIERS) {
      expect(tier.limits.length).toBeGreaterThan(0);
    }
  });

  it("should have non-empty metricKey and label for each limit", () => {
    for (const tier of SERVICE_TIERS) {
      for (const limit of tier.limits) {
        expect(limit.metricKey).toBeTruthy();
        expect(limit.label).toBeTruthy();
        expect(limit.unit).toBeTruthy();
      }
    }
  });

  it("should include ElevenLabs tier", () => {
    const el = SERVICE_TIERS.find((t) => t.serviceId === "elevenlabs");
    expect(el).toBeDefined();
    expect(el!.currentTierName).toBe("Starter");
    expect(el!.limits[0].monthlyLimit).toBe(30);
  });

  it("should include Vercel tier", () => {
    const vercel = SERVICE_TIERS.find((t) => t.serviceId === "vercel");
    expect(vercel).toBeDefined();
    expect(vercel!.currentTierName).toBe("Hobby");
  });

  it("should include PostHog tier", () => {
    const ph = SERVICE_TIERS.find((t) => t.serviceId === "posthog");
    expect(ph).toBeDefined();
    expect(ph!.limits[0].monthlyLimit).toBe(1000000);
  });

  it("should include Supabase tier", () => {
    const sb = SERVICE_TIERS.find((t) => t.serviceId === "supabase");
    expect(sb).toBeDefined();
    expect(sb!.currentMonthlyCostUsd).toBe(25);
  });
});
