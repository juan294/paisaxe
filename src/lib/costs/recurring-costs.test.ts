import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateRecurringCosts } from "./recurring-costs";

describe("generateRecurringCosts", () => {
  it("should generate costs for the current month", () => {
    const costs = generateRecurringCosts("2026-02-01", "2026-02-28");

    // Should include Supabase, ElevenLabs, AWS Domains, GitHub Pro, Anthropic, Claude Code Max, Vercel, and Twilio Phone
    expect(costs.length).toBe(8);

    const supabase = costs.find((c) => c.serviceId === "supabase");
    expect(supabase).toBeDefined();
    expect(supabase!.costUsd).toBe(25);
    expect(supabase!.source).toBe("recurring");

    const elevenlabs = costs.find((c) => c.serviceId === "elevenlabs");
    expect(elevenlabs).toBeDefined();
    // Effective monthly rate: $266.20/yr ÷ 12 = $22.18/mo (includes tax)
    expect(elevenlabs!.costUsd).toBe(22.18);
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

  it("should include Claude Code Max for February 2026", () => {
    const costs = generateRecurringCosts("2026-02-01", "2026-02-28");
    const claudeCode = costs.find((c) => c.serviceId === "claude-code-max");

    expect(claudeCode).toBeDefined();
    expect(claudeCode!.costUsd).toBe(200);
    expect(claudeCode!.category).toBe("development");
    expect(claudeCode!.source).toBe("recurring");
  });

  it("should not include Claude Code Max before its start date", () => {
    const costs = generateRecurringCosts("2026-01-01", "2026-01-20");
    const claudeCode = costs.find((c) => c.serviceId === "claude-code-max");

    expect(claudeCode).toBeUndefined();
  });

  it("should return empty array for date range before any subscriptions", () => {
    const costs = generateRecurringCosts("2024-01-01", "2024-12-31");
    expect(costs).toEqual([]);
  });

});

describe("generateRecurringCosts with endDate subscriptions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should skip subscriptions whose endDate is before the query start", async () => {
    vi.doMock("@/config/recurring-costs", () => ({
      RECURRING_SUBSCRIPTIONS: [
        {
          serviceId: "old-service",
          serviceName: "Old Service",
          category: "infrastructure",
          costUsd: 10,
          billingCycle: "monthly",
          notes: "Cancelled subscription",
          dashboardUrl: "https://example.com",
          startDate: "2024-01-01",
          endDate: "2024-06-30", // Ended June 2024
        },
        {
          serviceId: "active-service",
          serviceName: "Active Service",
          category: "infrastructure",
          costUsd: 20,
          billingCycle: "monthly",
          notes: "Still active",
          dashboardUrl: "https://example.com/active",
          startDate: "2024-01-01",
          // No endDate = ongoing
        },
      ],
    }));

    const { generateRecurringCosts: genCosts } = await import("./recurring-costs");

    // Query for July 2024 — old-service ended in June, so it should be skipped
    const costs = genCosts("2024-07-01", "2024-07-31");

    expect(costs).toHaveLength(1);
    expect(costs[0].serviceId).toBe("active-service");
  });

  it("should include subscriptions whose endDate overlaps the query period", async () => {
    vi.doMock("@/config/recurring-costs", () => ({
      RECURRING_SUBSCRIPTIONS: [
        {
          serviceId: "ending-service",
          serviceName: "Ending Service",
          category: "ai",
          costUsd: 15,
          billingCycle: "monthly",
          notes: "Ending mid-month",
          dashboardUrl: "https://example.com/ending",
          startDate: "2024-01-01",
          endDate: "2024-07-15", // Ends mid-July
        },
      ],
    }));

    const { generateRecurringCosts: genCosts } = await import("./recurring-costs");

    // Query for July — endDate (July 15) is within the range, so it should be included
    const costs = genCosts("2024-07-01", "2024-07-31");

    expect(costs).toHaveLength(1);
    expect(costs[0].serviceId).toBe("ending-service");
    expect(costs[0].costUsd).toBe(15);
  });

  it("should fall back to sub.dashboardUrl when service not in PLATFORM_SERVICES", async () => {
    vi.doMock("@/config/recurring-costs", () => ({
      RECURRING_SUBSCRIPTIONS: [
        {
          serviceId: "unknown-service",
          serviceName: "Unknown Service",
          category: "infrastructure",
          costUsd: 5,
          billingCycle: "monthly",
          notes: "Not in PLATFORM_SERVICES",
          dashboardUrl: "https://unknown.example.com/billing",
          startDate: "2024-01-01",
        },
      ],
    }));

    const { generateRecurringCosts: genCosts } = await import("./recurring-costs");

    const costs = genCosts("2024-07-01", "2024-07-31");

    expect(costs).toHaveLength(1);
    // Should fall back to the subscription's own dashboardUrl
    expect(costs[0].dashboardUrl).toBe("https://unknown.example.com/billing");
  });
});
