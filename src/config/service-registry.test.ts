import { describe, it, expect } from "vitest";
import { SERVICE_REGISTRY } from "./service-registry";
import { RECURRING_SUBSCRIPTIONS } from "./recurring-costs";
import { SERVICE_TIERS } from "./service-tiers";

describe("SERVICE_REGISTRY config", () => {
  it("should have at least one service registered", () => {
    expect(SERVICE_REGISTRY.length).toBeGreaterThan(0);
  });

  it("should have unique serviceIds", () => {
    const ids = SERVICE_REGISTRY.map((s) => s.serviceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have required fields for every entry", () => {
    for (const entry of SERVICE_REGISTRY) {
      expect(entry.serviceId).toBeTruthy();
      expect(entry.serviceName).toBeTruthy();
      expect(entry.currentPlan).toBeTruthy();
      expect(entry.dashboardUrl).toBeTruthy();
      expect(entry.changelogUrl).toBeTruthy();
      expect(Array.isArray(entry.includedFeatures)).toBe(true);
      expect(entry.includedFeatures.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.areasToWatch)).toBe(true);
      expect(entry.areasToWatch.length).toBeGreaterThan(0);
    }
  });

  it("should cover all services from RECURRING_SUBSCRIPTIONS", () => {
    const registryIds = SERVICE_REGISTRY.map((s) => s.serviceId);
    for (const sub of RECURRING_SUBSCRIPTIONS) {
      expect(registryIds).toContain(sub.serviceId);
    }
  });

  it("should cover all services from SERVICE_TIERS", () => {
    const registryIds = SERVICE_REGISTRY.map((s) => s.serviceId);
    for (const tier of SERVICE_TIERS) {
      expect(registryIds).toContain(tier.serviceId);
    }
  });

  it("should include ElevenLabs with Creator plan", () => {
    const el = SERVICE_REGISTRY.find((s) => s.serviceId === "elevenlabs");
    expect(el).toBeDefined();
    expect(el!.currentPlan).toBe("Creator");
    expect(el!.monthlyCostUsd).toBe(18.33);
  });

  it("should include Supabase with Pro plan", () => {
    const sb = SERVICE_REGISTRY.find((s) => s.serviceId === "supabase");
    expect(sb).toBeDefined();
    expect(sb!.currentPlan).toBe("Pro");
    expect(sb!.monthlyCostUsd).toBe(25);
  });

  it("should include GitHub Pro", () => {
    const gh = SERVICE_REGISTRY.find((s) => s.serviceId === "github-pro");
    expect(gh).toBeDefined();
    expect(gh!.currentPlan).toBe("Pro");
    expect(gh!.monthlyCostUsd).toBe(4);
  });

  it("should include Vercel", () => {
    const v = SERVICE_REGISTRY.find((s) => s.serviceId === "vercel");
    expect(v).toBeDefined();
    expect(v!.currentPlan).toBe("Hobby");
    expect(v!.monthlyCostUsd).toBe(0);
  });

  it("should include Anthropic", () => {
    const a = SERVICE_REGISTRY.find((s) => s.serviceId === "anthropic");
    expect(a).toBeDefined();
    expect(a!.currentPlan).toBe("Personal (Pay-as-you-go)");
  });

  it("should include Stripe", () => {
    const s = SERVICE_REGISTRY.find((e) => e.serviceId === "stripe");
    expect(s).toBeDefined();
    expect(s!.currentPlan).toBe("Pay-as-you-go");
  });

  it("should include Voyage AI", () => {
    const v = SERVICE_REGISTRY.find((s) => s.serviceId === "voyage");
    expect(v).toBeDefined();
  });

  it("should include Twilio", () => {
    const t = SERVICE_REGISTRY.find((s) => s.serviceId === "twilio");
    expect(t).toBeDefined();
  });

  it("should include Google AI Pro", () => {
    const g = SERVICE_REGISTRY.find((s) => s.serviceId === "google-ai-pro");
    expect(g).toBeDefined();
    expect(g!.areasToWatch).toContain("bundled perks");
  });

  it("should include Claude Code Max", () => {
    const cc = SERVICE_REGISTRY.find((s) => s.serviceId === "claude-code-max");
    expect(cc).toBeDefined();
    expect(cc!.currentPlan).toBe("Max (20x)");
    expect(cc!.monthlyCostUsd).toBe(200);
  });

  it("should have valid monthlyCostUsd (non-negative number)", () => {
    for (const entry of SERVICE_REGISTRY) {
      expect(entry.monthlyCostUsd).toBeGreaterThanOrEqual(0);
      expect(typeof entry.monthlyCostUsd).toBe("number");
    }
  });

  it("should have includedFeatures with non-empty strings", () => {
    for (const entry of SERVICE_REGISTRY) {
      for (const feature of entry.includedFeatures) {
        expect(feature.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("should have usedFeatures as a subset of includedFeatures", () => {
    for (const entry of SERVICE_REGISTRY) {
      if (entry.usedFeatures) {
        for (const used of entry.usedFeatures) {
          expect(entry.includedFeatures).toContain(used);
        }
      }
    }
  });
});
