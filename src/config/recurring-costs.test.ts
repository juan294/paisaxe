import { describe, it, expect } from "vitest";
import { RECURRING_SUBSCRIPTIONS } from "./recurring-costs";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";

describe("RECURRING_SUBSCRIPTIONS config", () => {
  it("should have at least one subscription", () => {
    expect(RECURRING_SUBSCRIPTIONS.length).toBeGreaterThan(0);
  });

  it("should have valid serviceIds matching PLATFORM_SERVICES", () => {
    const platformIds = Object.values(PLATFORM_SERVICES).map((s) => s.id);

    for (const sub of RECURRING_SUBSCRIPTIONS) {
      expect(platformIds).toContain(sub.serviceId);
    }
  });

  it("should have positive cost values", () => {
    for (const sub of RECURRING_SUBSCRIPTIONS) {
      expect(sub.costUsd).toBeGreaterThan(0);
    }
  });

  it("should have valid date formats", () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (const sub of RECURRING_SUBSCRIPTIONS) {
      expect(sub.startDate).toMatch(dateRegex);
      if (sub.endDate) {
        expect(sub.endDate).toMatch(dateRegex);
      }
    }
  });

  it("should have monthly billing cycle", () => {
    for (const sub of RECURRING_SUBSCRIPTIONS) {
      expect(sub.billingCycle).toBe("monthly");
    }
  });

  it("should include Supabase subscription", () => {
    const supabase = RECURRING_SUBSCRIPTIONS.find(
      (s) => s.serviceId === "supabase"
    );
    expect(supabase).toBeDefined();
    expect(supabase!.costUsd).toBe(25);
  });

  it("should include ElevenLabs subscription at effective rate with tax", () => {
    const elevenlabs = RECURRING_SUBSCRIPTIONS.find(
      (s) => s.serviceId === "elevenlabs"
    );
    expect(elevenlabs).toBeDefined();
    // Effective monthly rate: $266.20/yr ÷ 12 = $22.18/mo (includes tax)
    expect(elevenlabs!.costUsd).toBe(22.18);
    expect(elevenlabs!.notes).toContain("$266.20");
  });

  it("should include AWS Domains subscription", () => {
    const aws = RECURRING_SUBSCRIPTIONS.find(
      (s) => s.serviceId === "aws-domains"
    );
    expect(aws).toBeDefined();
    expect(aws!.costUsd).toBeCloseTo(2.08, 2);
    expect(aws!.notes).toContain("paisaxe.es");
    expect(aws!.notes).toContain("paisaxe.com");
  });

  it("should include GitHub Pro subscription", () => {
    const github = RECURRING_SUBSCRIPTIONS.find(
      (s) => s.serviceId === "github-pro"
    );
    expect(github).toBeDefined();
    expect(github!.costUsd).toBe(4);
    expect(github!.category).toBe("infrastructure");
    expect(github!.serviceName).toBe("GitHub Pro");
  });

  it("should include Claude Code Max subscription", () => {
    const claudeCode = RECURRING_SUBSCRIPTIONS.find(
      (s) => s.serviceId === "claude-code-max"
    );
    expect(claudeCode).toBeDefined();
    expect(claudeCode!.costUsd).toBe(200);
    expect(claudeCode!.category).toBe("development");
    expect(claudeCode!.serviceName).toBe("Claude Code Max");
    expect(claudeCode!.notes).toContain("20x");
  });
});
