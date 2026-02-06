import { describe, it, expect } from "vitest";
import { generateRecurringCosts } from "./recurring-costs";

describe("generateRecurringCosts", () => {
  it("should generate costs for the current month", () => {
    const costs = generateRecurringCosts("2026-02-01", "2026-02-28");

    // Should include Supabase, ElevenLabs, and AWS Domains
    expect(costs.length).toBe(3);

    const supabase = costs.find((c) => c.serviceId === "supabase");
    expect(supabase).toBeDefined();
    expect(supabase!.costUsd).toBe(25);
    expect(supabase!.source).toBe("recurring");

    const elevenlabs = costs.find((c) => c.serviceId === "elevenlabs");
    expect(elevenlabs).toBeDefined();
    expect(elevenlabs!.costUsd).toBe(5);
    expect(elevenlabs!.source).toBe("recurring");
  });

  it("should skip subscriptions that haven't started yet", () => {
    // Query for January 2026 — ElevenLabs starts Feb 2026
    const costs = generateRecurringCosts("2026-01-01", "2026-01-31");

    const elevenlabs = costs.find((c) => c.serviceId === "elevenlabs");
    expect(elevenlabs).toBeUndefined();

    const supabase = costs.find((c) => c.serviceId === "supabase");
    expect(supabase).toBeDefined();
  });

  it("should include correct billing period in output", () => {
    const costs = generateRecurringCosts("2026-03-01", "2026-03-31");

    for (const cost of costs) {
      expect(cost.billingPeriodStart).toBe("2026-03-01");
      expect(cost.billingPeriodEnd).toBe("2026-03-31");
    }
  });

  it("should format cost as USD", () => {
    const costs = generateRecurringCosts("2026-02-01", "2026-02-28");
    const supabase = costs.find((c) => c.serviceId === "supabase");

    expect(supabase!.costFormatted).toBe("$25.00");
  });

  it("should include dashboard URL from PLATFORM_SERVICES", () => {
    const costs = generateRecurringCosts("2026-02-01", "2026-02-28");
    const supabase = costs.find((c) => c.serviceId === "supabase");

    expect(supabase!.dashboardUrl).toBe(
      "https://supabase.com/dashboard/org/_/billing"
    );
  });

  it("should include notes from subscription config", () => {
    const costs = generateRecurringCosts("2026-02-01", "2026-02-28");
    const supabase = costs.find((c) => c.serviceId === "supabase");

    expect(supabase!.notes).toBe("Pro plan base cost");
  });

  it("should return empty array for date range before any subscriptions", () => {
    const costs = generateRecurringCosts("2024-01-01", "2024-12-31");
    expect(costs).toEqual([]);
  });
});
