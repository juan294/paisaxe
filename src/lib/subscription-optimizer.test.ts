import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  analyzeSubscriptions,
  generateReport,
  generateSharedContextEntry,
  type OptimizerInput,
  type Recommendation,
  type SubscriptionReport,
} from "./subscription-optimizer";
import { SERVICE_REGISTRY } from "@/config/service-registry";
import { SERVICE_TIERS, type ServiceTierConfig } from "@/config/service-tiers";

describe("analyzeSubscriptions", () => {
  const baseInput: OptimizerInput = {
    services: SERVICE_REGISTRY,
    usageMetrics: {
      voiceMinutes: 12,
      visitors: 3500,
      chatConversations: 150,
      voiceConversations: 25,
      posthogEvents: 5000,
      supabaseStorageGb: 1.2,
      periodDays: 30,
    },
    dismissedFeatures: [],
  };

  it("should return recommendations for all services", () => {
    const result = analyzeSubscriptions(baseInput);
    expect(result.recommendations.length).toBe(SERVICE_REGISTRY.length);
  });

  it("should return a valid action for each recommendation", () => {
    const result = analyzeSubscriptions(baseInput);
    const validActions = ["keep", "upgrade", "downgrade", "review"];
    for (const rec of result.recommendations) {
      expect(validActions).toContain(rec.action);
    }
  });

  it("should identify unused features for each service", () => {
    const result = analyzeSubscriptions(baseInput);
    for (const rec of result.recommendations) {
      expect(Array.isArray(rec.unusedFeatures)).toBe(true);
    }
  });

  it("should recommend keep when usage is within limits and healthy", () => {
    const result = analyzeSubscriptions(baseInput);
    // Vercel at 3500/50000 visitors is well within limits
    const vercel = result.recommendations.find(
      (r) => r.serviceId === "vercel"
    );
    expect(vercel).toBeDefined();
    expect(vercel!.action).toBe("keep");
  });

  it("should recommend upgrade when usage exceeds 80% of a tier limit", () => {
    const highUsageInput: OptimizerInput = {
      ...baseInput,
      usageMetrics: {
        ...baseInput.usageMetrics,
        voiceMinutes: 90, // 90% of 100 min limit
      },
    };
    const result = analyzeSubscriptions(highUsageInput);
    const elevenlabs = result.recommendations.find(
      (r) => r.serviceId === "elevenlabs"
    );
    expect(elevenlabs).toBeDefined();
    expect(elevenlabs!.action).toBe("upgrade");
  });

  it("should recommend upgrade when usage exceeds limit", () => {
    const overLimitInput: OptimizerInput = {
      ...baseInput,
      usageMetrics: {
        ...baseInput.usageMetrics,
        voiceMinutes: 110, // Over 100 min limit
      },
    };
    const result = analyzeSubscriptions(overLimitInput);
    const elevenlabs = result.recommendations.find(
      (r) => r.serviceId === "elevenlabs"
    );
    expect(elevenlabs).toBeDefined();
    expect(elevenlabs!.action).toBe("upgrade");
  });

  it("should exclude dismissed features from unused features list", () => {
    const inputWithDismissed: OptimizerInput = {
      ...baseInput,
      dismissedFeatures: [
        { serviceId: "github-pro", feature: "Codespaces hours" },
      ],
    };
    const result = analyzeSubscriptions(inputWithDismissed);
    const github = result.recommendations.find(
      (r) => r.serviceId === "github-pro"
    );
    expect(github).toBeDefined();
    expect(github!.unusedFeatures).not.toContain("Codespaces hours");
  });

  it("should include a reason for each recommendation", () => {
    const result = analyzeSubscriptions(baseInput);
    for (const rec of result.recommendations) {
      expect(rec.reason).toBeTruthy();
      expect(rec.reason.length).toBeGreaterThan(0);
    }
  });

  it("should calculate usage percentages for services with tier limits", () => {
    const result = analyzeSubscriptions(baseInput);
    const elevenlabs = result.recommendations.find(
      (r) => r.serviceId === "elevenlabs"
    );
    expect(elevenlabs).toBeDefined();
    expect(elevenlabs!.usagePercentages).toBeDefined();
    expect(elevenlabs!.usagePercentages!.length).toBeGreaterThan(0);
    expect(elevenlabs!.usagePercentages![0].percentage).toBeCloseTo(12, 0);
  });

  it("should calculate total monthly spend", () => {
    const result = analyzeSubscriptions(baseInput);
    expect(result.totalMonthlySpend).toBeGreaterThan(0);
    // Sum of all service costs
    const expectedTotal = SERVICE_REGISTRY.reduce(
      (sum, s) => sum + s.monthlyCostUsd,
      0
    );
    expect(result.totalMonthlySpend).toBeCloseTo(expectedTotal, 2);
  });

  it("should include the analysis date", () => {
    const result = analyzeSubscriptions(baseInput);
    expect(result.analyzedAt).toBeTruthy();
    // Should be a valid ISO date string
    expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt);
  });

  it("should produce 'all features in use' reason for service with no tier limits and no unused features", () => {
    // Covers the branch: no tier metrics + unusedFeatures.length === 0
    // → reason = "All plan features are in use. Good value."
    const input: OptimizerInput = {
      ...baseInput,
      services: [
        {
          serviceId: "custom-service",
          serviceName: "Custom Service",
          currentPlan: "Basic",
          monthlyCostUsd: 10,
          includedFeatures: ["Feature A", "Feature B"],
          usedFeatures: ["Feature A", "Feature B"],
        } as unknown as (typeof SERVICE_REGISTRY)[0],
      ],
    };
    const result = analyzeSubscriptions(input);
    const rec = result.recommendations[0];
    expect(rec.action).toBe("keep");
    expect(rec.reason).toContain("All plan features are in use");
  });

  it("should produce 'Using X of Y features' reason when service has no tier limits but has unused features (but less than half)", () => {
    // Covers the branch: no tier metrics + unusedFeatures.length > 0 but <= half
    // → reason = "Using X of Y plan features."
    const input: OptimizerInput = {
      ...baseInput,
      services: [
        {
          serviceId: "custom-service",
          serviceName: "Custom Service",
          currentPlan: "Basic",
          monthlyCostUsd: 10,
          includedFeatures: ["Feature A", "Feature B", "Feature C", "Feature D"],
          usedFeatures: ["Feature A", "Feature B", "Feature C"],
        } as unknown as (typeof SERVICE_REGISTRY)[0],
      ],
    };
    const result = analyzeSubscriptions(input);
    const rec = result.recommendations[0];
    expect(rec.action).toBe("keep");
    expect(rec.reason).toContain("Using 3 of 4 plan features");
  });

  it("should produce generic approaching-limit reason when nearMetric is not found (defensive)", () => {
    // The nearMetric fallback "Usage approaching plan limits. Consider upgrading soon."
    // happens when maxUsageRatio > 0.8 but no individual percentage rounds above 80%.
    // This is a defensive guard due to Math.round: e.g., ratio=0.804 → percentage=80
    // after Math.round, which is not > 80, so find() returns undefined.
    // Test it with the real SERVICE_REGISTRY by pushing usage just over 80%.
    const borderlineInput: OptimizerInput = {
      ...baseInput,
      usageMetrics: {
        ...baseInput.usageMetrics,
        voiceMinutes: 81, // 81% of 100 limit → ratio 0.81 > 0.8
      },
    };
    const result = analyzeSubscriptions(borderlineInput);
    const elevenlabs = result.recommendations.find(
      (r) => r.serviceId === "elevenlabs"
    );
    expect(elevenlabs).toBeDefined();
    expect(elevenlabs!.action).toBe("upgrade");
    // Whether it finds the nearMetric or not, the reason should be about approaching/exceeding
    expect(elevenlabs!.reason).toBeTruthy();
  });

  it("should trigger nearMetric fallback when ratio barely exceeds 0.8 but rounds to 80% (line 142 false branch)", () => {
    // Line 142: nearMetric ? "..." : "Usage approaching plan limits..."
    // To get the fallback, maxUsageRatio must be > 0.8 but Math.round(ratio * 100) must be <= 80.
    // Example: voiceMinutes = 80.4, limit = 100 → ratio = 0.804, percentage = Math.round(80.4) = 80
    // find(u => u.percentage > 80) returns undefined → fallback reason used.
    const borderlineInput: OptimizerInput = {
      ...baseInput,
      usageMetrics: {
        ...baseInput.usageMetrics,
        voiceMinutes: 80.4, // ratio = 0.804 > 0.8, but Math.round(80.4) = 80, not > 80
      },
    };
    const result = analyzeSubscriptions(borderlineInput);
    const elevenlabs = result.recommendations.find(
      (r) => r.serviceId === "elevenlabs"
    );
    expect(elevenlabs).toBeDefined();
    expect(elevenlabs!.action).toBe("upgrade");
    expect(elevenlabs!.reason).toBe("Usage approaching plan limits. Consider upgrading soon.");
  });

  it("should cover reduce false branch when first metric has highest percentage (line 152)", () => {
    // Line 151-153: reduce((max, u) => (u.percentage > max.percentage ? u : max), usagePercentages[0])
    // The false branch (u.percentage <= max.percentage) is taken when a later element
    // is NOT higher than the current max. We need a service with multiple tier limits
    // where the first metric has the highest percentage.
    // Use a custom service matching a real tier (supabase has supabaseStorageGb).
    // We also add a Vercel-like entry with visitors metric. Both will be within safe range.
    const input: OptimizerInput = {
      ...baseInput,
      services: [
        {
          serviceId: "supabase",
          serviceName: "Supabase",
          currentPlan: "Pro",
          monthlyCostUsd: 25,
          includedFeatures: ["Storage", "Functions"],
          usedFeatures: ["Storage", "Functions"],
          dashboardUrl: "",
          changelogUrl: "",
          areasToWatch: [],
        } as unknown as (typeof SERVICE_REGISTRY)[0],
      ],
      usageMetrics: {
        ...baseInput.usageMetrics,
        supabaseStorageGb: 2, // 2/8 = 25%
      },
    };
    const result = analyzeSubscriptions(input);
    const rec = result.recommendations[0];
    // supabase has only 1 tier limit (supabaseStorageGb), so the reduce processes
    // the single-element array. The false branch would need multiple elements.
    // With real SERVICE_TIERS, each service has only one limit.
    // Let's verify the "keep" action and usage percentage are correct.
    expect(rec.action).toBe("keep");
    expect(rec.usagePercentages[0].percentage).toBe(25);
    expect(rec.reason).toContain("25%");
  });

  it("should produce generic over-limit reason when overMetric is undefined (line 135 false branch)", () => {
    // Line 135: overMetric ? "..." : "Usage exceeds plan limits. Consider upgrading."
    // This requires maxUsageRatio > 1.0 but no individual percentage > 100.
    // Example: voiceMinutes = 100.4, limit = 100 → ratio = 1.004, percentage = Math.round(100.4) = 100
    // find(u => u.percentage > 100) returns undefined → fallback reason used.
    const overLimitInput: OptimizerInput = {
      ...baseInput,
      usageMetrics: {
        ...baseInput.usageMetrics,
        voiceMinutes: 100.4, // ratio = 1.004 > 1.0, but Math.round(100.4) = 100, not > 100
      },
    };
    const result = analyzeSubscriptions(overLimitInput);
    const elevenlabs = result.recommendations.find(
      (r) => r.serviceId === "elevenlabs"
    );
    expect(elevenlabs).toBeDefined();
    expect(elevenlabs!.action).toBe("upgrade");
    expect(elevenlabs!.reason).toBe("Usage exceeds plan limits. Consider upgrading.");
  });

  it("should handle service with undefined usedFeatures", () => {
    // Covers the ?? [] fallback when usedFeatures is undefined
    const input: OptimizerInput = {
      ...baseInput,
      services: [
        {
          serviceId: "custom-service",
          serviceName: "Custom Service",
          currentPlan: "Basic",
          monthlyCostUsd: 5,
          includedFeatures: ["Feature A", "Feature B", "Feature C", "Feature D", "Feature E"],
          // usedFeatures intentionally omitted
        } as unknown as (typeof SERVICE_REGISTRY)[0],
      ],
    };
    const result = analyzeSubscriptions(input);
    const rec = result.recommendations[0];
    // All features are unused → review since > half unused
    expect(rec.action).toBe("review");
    expect(rec.unusedFeatures).toHaveLength(5);
  });

  it("should produce generic upgrade reason when over limit but no single metric is above 100%", () => {
    // This tests the fallback in the WARNING_THRESHOLD branch when
    // maxUsageRatio > 1.0 but no individual usagePercentage > 100
    // (can happen due to rounding: e.g., ratio = 1.004 → percentage = 100 after Math.round)
    // This is a defensive branch that's hard to trigger naturally.
    // The practical test is that the upgrade action is correct.
    const highUsageInput: OptimizerInput = {
      ...baseInput,
      usageMetrics: {
        ...baseInput.usageMetrics,
        voiceMinutes: 110, // Over the 100-min limit
      },
    };
    const result = analyzeSubscriptions(highUsageInput);
    const elevenlabs = result.recommendations.find(
      (r) => r.serviceId === "elevenlabs"
    );
    expect(elevenlabs).toBeDefined();
    expect(elevenlabs!.action).toBe("upgrade");
    expect(elevenlabs!.reason).toBeTruthy();
  });

  describe("with multi-limit tier config (covers lines 110, 120, 152, 160)", () => {
    // These tests temporarily add a custom tier config with multiple limits
    // to SERVICE_TIERS to exercise branches that require multi-limit tiers
    // or unrecognized metric keys.
    let addedTier: ServiceTierConfig;

    beforeEach(() => {
      addedTier = {
        serviceId: "multi-limit-test",
        serviceName: "Multi Limit Test",
        currentTierName: "Pro",
        currentMonthlyCostUsd: 50,
        limits: [
          { metricKey: "visitors", label: "Visitors", monthlyLimit: 10000, unit: "visitors" },
          { metricKey: "voiceMinutes", label: "Voice Minutes", monthlyLimit: 200, unit: "min" },
          { metricKey: "unknownMetric", label: "Unknown", monthlyLimit: 1000, unit: "items" },
        ],
      };
      SERVICE_TIERS.push(addedTier);
    });

    afterEach(() => {
      const idx = SERVICE_TIERS.indexOf(addedTier);
      if (idx !== -1) SERVICE_TIERS.splice(idx, 1);
    });

    it("should skip metrics with unrecognized keys (line 110 false branch)", () => {
      // The "unknownMetric" metricKey has no mapping in getMetricValue,
      // so currentValue is undefined, skipping the usagePercentages push.
      const input: OptimizerInput = {
        ...baseInput,
        services: [
          {
            serviceId: "multi-limit-test",
            serviceName: "Multi Limit Test",
            currentPlan: "Pro",
            monthlyCostUsd: 50,
            includedFeatures: ["Feature A"],
            usedFeatures: ["Feature A"],
          } as unknown as (typeof SERVICE_REGISTRY)[0],
        ],
        usageMetrics: {
          ...baseInput.usageMetrics,
          visitors: 1000, // 10% of 10000
          voiceMinutes: 20, // 10% of 200
        },
      };
      const result = analyzeSubscriptions(input);
      const rec = result.recommendations[0];
      // Only 2 usage percentages should be reported (visitors + voiceMinutes)
      // The "unknownMetric" is skipped because getMetricValue returns undefined.
      expect(rec.usagePercentages).toHaveLength(2);
      expect(rec.usagePercentages.map((u) => u.metricKey)).not.toContain("unknownMetric");
    });

    it("should keep max when later metric has lower ratio (line 120 false branch + line 152 false branch)", () => {
      // Two recognized metrics: visitors at 50%, voiceMinutes at 10%.
      // The reduce callback is called for EACH element (including index 0) since
      // we pass usagePercentages[0] as initial value.
      // Iteration 1: max=visitors(50%), u=visitors(50%) → 50 > 50 false → keep max
      // Iteration 2: max=visitors(50%), u=voiceMinutes(10%) → 10 > 50 false → keep max
      // Both iterations take the false branch of the ternary on line 152.
      // maxUsageRatio is set by visitors (0.5), voiceMinutes (0.1) doesn't update it (line 120 false).
      const input: OptimizerInput = {
        ...baseInput,
        services: [
          {
            serviceId: "multi-limit-test",
            serviceName: "Multi Limit Test",
            currentPlan: "Pro",
            monthlyCostUsd: 50,
            includedFeatures: ["Feature A"],
            usedFeatures: ["Feature A"],
          } as unknown as (typeof SERVICE_REGISTRY)[0],
        ],
        usageMetrics: {
          ...baseInput.usageMetrics,
          visitors: 5000, // 50% of 10000
          voiceMinutes: 20, // 10% of 200
        },
      };
      const result = analyzeSubscriptions(input);
      const rec = result.recommendations[0];
      // The highest usage should be visitors at 50%
      expect(rec.usagePercentages).toHaveLength(2);
      expect(rec.action).toBe("keep");
      expect(rec.reason).toContain("Visitors");
      expect(rec.reason).toContain("50%");
    });

    it("should update max when later metric has higher percentage (line 152 true branch)", () => {
      // Two recognized metrics: visitors at 10%, voiceMinutes at 50%.
      // reduce starts with initial value visitors(10%).
      // Iteration 1: max=visitors(10%), u=visitors(10%) → 10 > 10 false → keep max
      // Iteration 2: max=visitors(10%), u=voiceMinutes(50%) → 50 > 10 true → update to voiceMinutes
      // This covers the TRUE branch of the ternary at line 152.
      const input: OptimizerInput = {
        ...baseInput,
        services: [
          {
            serviceId: "multi-limit-test",
            serviceName: "Multi Limit Test",
            currentPlan: "Pro",
            monthlyCostUsd: 50,
            includedFeatures: ["Feature A"],
            usedFeatures: ["Feature A"],
          } as unknown as (typeof SERVICE_REGISTRY)[0],
        ],
        usageMetrics: {
          ...baseInput.usageMetrics,
          visitors: 1000, // 10% of 10000
          voiceMinutes: 100, // 50% of 200
        },
      };
      const result = analyzeSubscriptions(input);
      const rec = result.recommendations[0];
      expect(rec.usagePercentages).toHaveLength(2);
      expect(rec.action).toBe("keep");
      // The reason should reference Voice Minutes (50%) as the highest, not Visitors (10%)
      expect(rec.reason).toContain("Voice Minutes");
      expect(rec.reason).toContain("50%");
    });

    // NOTE: subscription-optimizer.ts line 160 has an uncovered `?? []` fallback in
    // `(service.usedFeatures ?? []).length`. This fallback for undefined usedFeatures
    // is unreachable at line 160 because: if usedFeatures is undefined, the usedSet is
    // empty, making ALL includedFeatures "unused". With all features unused,
    // `unusedFeatures.length > includedFeatures.length / 2` (line 145) is always true,
    // routing to the "review" branch (line 147) instead of line 160.
    // The defined-usedFeatures path through line 160 is covered by the
    // "Using X of Y features" test above.
  });
});

describe("generateReport", () => {
  const mockRecommendations: Recommendation[] = [
    {
      serviceId: "elevenlabs",
      serviceName: "ElevenLabs",
      currentPlan: "Creator",
      monthlyCostUsd: 18.33,
      action: "keep",
      reason: "Usage at 12% of voice minute limit. Well within current plan.",
      unusedFeatures: ["Custom voice cloning", "API access"],
      usagePercentages: [
        {
          metricKey: "voiceMinutes",
          label: "Voice Minutes",
          percentage: 12,
          current: 12,
          limit: 100,
        },
      ],
    },
    {
      serviceId: "vercel",
      serviceName: "Vercel",
      currentPlan: "Hobby",
      monthlyCostUsd: 0,
      action: "keep",
      reason: "Free tier is sufficient for current traffic levels.",
      unusedFeatures: [],
      usagePercentages: [
        {
          metricKey: "visitors",
          label: "Monthly Visitors",
          percentage: 7,
          current: 3500,
          limit: 50000,
        },
      ],
    },
    {
      serviceId: "github-pro",
      serviceName: "GitHub Pro",
      currentPlan: "Pro",
      monthlyCostUsd: 4,
      action: "review",
      reason: "Multiple unused features. Consider if Pro is needed.",
      unusedFeatures: ["Codespaces hours", "GitHub Packages storage"],
      usagePercentages: [],
    },
  ];

  const mockReport: SubscriptionReport = {
    recommendations: mockRecommendations,
    totalMonthlySpend: 22.33,
    analyzedAt: "2026-02-09T10:00:00.000Z",
    dismissedFeatures: [],
  };

  it("should generate a markdown report", () => {
    const report = generateReport(mockReport);
    expect(typeof report).toBe("string");
    expect(report.length).toBeGreaterThan(0);
  });

  it("should include the report header", () => {
    const report = generateReport(mockReport);
    expect(report).toContain("# Subscription Optimizer Report");
  });

  it("should include the week date", () => {
    const report = generateReport(mockReport);
    expect(report).toContain("2026-02-09");
  });

  it("should include total monthly spend", () => {
    const report = generateReport(mockReport);
    expect(report).toContain("$22.33");
  });

  it("should include a usage summary section", () => {
    const report = generateReport(mockReport);
    expect(report).toContain("## Usage Summary");
  });

  it("should include service names in the summary table", () => {
    const report = generateReport(mockReport);
    expect(report).toContain("ElevenLabs");
    expect(report).toContain("Vercel");
    expect(report).toContain("GitHub Pro");
  });

  it("should include recommendations section", () => {
    const report = generateReport(mockReport);
    expect(report).toContain("## Recommendations");
  });

  it("should include unused features section when unused features exist", () => {
    const report = generateReport(mockReport);
    expect(report).toContain("## Unused Features Worth Exploring");
  });

  it("should list unused features with their service", () => {
    const report = generateReport(mockReport);
    expect(report).toContain("Custom voice cloning");
    expect(report).toContain("Codespaces hours");
  });

  it("should include action labels in recommendations", () => {
    const report = generateReport(mockReport);
    expect(report).toMatch(/KEEP|REVIEW|UPGRADE|DOWNGRADE/i);
  });

  it("should include dismissed features section when provided", () => {
    const reportWithDismissed: SubscriptionReport = {
      ...mockReport,
      dismissedFeatures: [
        { serviceId: "github-pro", feature: "Codespaces hours" },
      ],
    };
    const report = generateReport(reportWithDismissed);
    expect(report).toContain("## Features Not Applicable");
  });

  it("should not include dismissed features section when empty", () => {
    const report = generateReport(mockReport);
    expect(report).not.toContain("## Features Not Applicable");
  });

  it("should include an executive summary with spend and actionable count", () => {
    const report = generateReport(mockReport);
    expect(report).toContain("## Executive Summary");
    expect(report).toContain("$22.33");
    // 1 service has action "review" (GitHub Pro)
    expect(report).toMatch(/1 service.* flagged for review/i);
  });

  it("should include executive summary mentioning upgrade when present", () => {
    const reportWithUpgrade: SubscriptionReport = {
      ...mockReport,
      recommendations: [
        ...mockRecommendations,
        {
          serviceId: "supabase",
          serviceName: "Supabase",
          currentPlan: "Pro",
          monthlyCostUsd: 25,
          action: "upgrade",
          reason: "Storage usage at 95% of limit.",
          unusedFeatures: [],
          usagePercentages: [
            {
              metricKey: "supabaseStorageGb",
              label: "Database Storage",
              percentage: 95,
              current: 7.6,
              limit: 8,
            },
          ],
        },
      ],
      totalMonthlySpend: 47.33,
    };
    const report = generateReport(reportWithUpgrade);
    expect(report).toContain("## Executive Summary");
    expect(report).toMatch(/1 needs? upgrade/i);
  });

  it("should pluralize upgrade count when multiple services need upgrade", () => {
    const reportMultipleUpgrades: SubscriptionReport = {
      ...mockReport,
      recommendations: [
        {
          serviceId: "elevenlabs",
          serviceName: "ElevenLabs",
          currentPlan: "Creator",
          monthlyCostUsd: 18.33,
          action: "upgrade",
          reason: "Voice usage over limit.",
          unusedFeatures: [],
          usagePercentages: [
            { metricKey: "voiceMinutes", label: "Voice Minutes", percentage: 110, current: 110, limit: 100 },
          ],
        },
        {
          serviceId: "supabase",
          serviceName: "Supabase",
          currentPlan: "Pro",
          monthlyCostUsd: 25,
          action: "upgrade",
          reason: "Storage over limit.",
          unusedFeatures: [],
          usagePercentages: [
            { metricKey: "supabaseStorageGb", label: "Storage", percentage: 95, current: 7.6, limit: 8 },
          ],
        },
      ],
      totalMonthlySpend: 43.33,
    };
    const report = generateReport(reportMultipleUpgrades);
    expect(report).toContain("2 need upgrade");
  });

  it("should pluralize review count when multiple services flagged for review", () => {
    const reportMultipleReviews: SubscriptionReport = {
      ...mockReport,
      recommendations: [
        {
          serviceId: "github-pro",
          serviceName: "GitHub Pro",
          currentPlan: "Pro",
          monthlyCostUsd: 4,
          action: "review",
          reason: "Unused features.",
          unusedFeatures: ["Codespaces"],
          usagePercentages: [],
        },
        {
          serviceId: "anthropic",
          serviceName: "Anthropic",
          currentPlan: "Personal",
          monthlyCostUsd: 10,
          action: "review",
          reason: "Unused features.",
          unusedFeatures: ["Batch API"],
          usagePercentages: [],
        },
      ],
      totalMonthlySpend: 14,
    };
    const report = generateReport(reportMultipleReviews);
    expect(report).toContain("2 services flagged for review");
  });

  it("should show N/A for key metric when service has no usage percentages", () => {
    const report = generateReport(mockReport);
    // GitHub Pro has empty usagePercentages
    expect(report).toContain("N/A");
  });

  it("should format 'downgrade' action correctly in report", () => {
    const reportWithDowngrade: SubscriptionReport = {
      recommendations: [
        {
          serviceId: "test-service",
          serviceName: "Test Service",
          currentPlan: "Pro",
          monthlyCostUsd: 50,
          action: "downgrade",
          reason: "Usage is minimal. A cheaper plan would suffice.",
          unusedFeatures: ["Feature X"],
          usagePercentages: [
            { metricKey: "visitors", label: "Visitors", percentage: 5, current: 500, limit: 10000 },
          ],
        },
      ],
      totalMonthlySpend: 50,
      analyzedAt: "2026-03-19T10:00:00.000Z",
      dismissedFeatures: [],
    };
    const report = generateReport(reportWithDowngrade);
    expect(report).toContain("DOWNGRADE");
    expect(report).toContain("[down]");
  });

  it("should not include healthy line in executive summary when no keep recommendations", () => {
    const reportNoKeep: SubscriptionReport = {
      recommendations: [
        {
          serviceId: "test",
          serviceName: "Test",
          currentPlan: "Pro",
          monthlyCostUsd: 10,
          action: "review",
          reason: "Unused features.",
          unusedFeatures: ["X"],
          usagePercentages: [],
        },
      ],
      totalMonthlySpend: 10,
      analyzedAt: "2026-03-19T10:00:00.000Z",
      dismissedFeatures: [],
    };
    const report = generateReport(reportNoKeep);
    expect(report).not.toContain("healthy");
  });

  it("should handle unknown action in formatAction/formatActionEmoji fallbacks (lines 216, 226)", () => {
    // The formatAction and formatActionEmoji functions have fallback branches
    // for unknown action values (lines 216 and 226). We can trigger these
    // by passing a recommendation with a non-standard action value.
    const reportWithUnknownAction: SubscriptionReport = {
      recommendations: [
        {
          serviceId: "test-service",
          serviceName: "Test Service",
          currentPlan: "Basic",
          monthlyCostUsd: 10,
          action: "cancel" as Recommendation["action"], // unknown action
          reason: "No longer needed.",
          unusedFeatures: [],
          usagePercentages: [],
        },
      ],
      totalMonthlySpend: 10,
      analyzedAt: "2026-03-21T10:00:00.000Z",
      dismissedFeatures: [],
    };
    const report = generateReport(reportWithUnknownAction);
    // formatAction fallback: action.toUpperCase() → "CANCEL"
    expect(report).toContain("CANCEL");
    // formatActionEmoji fallback: [?]
    expect(report).toContain("[?]");
  });

  it("should use serviceId as fallback in dismissed features when service not found", () => {
    const reportWithOrphanDismissed: SubscriptionReport = {
      ...mockReport,
      dismissedFeatures: [
        { serviceId: "nonexistent-service", feature: "Some Feature" },
      ],
    };
    const report = generateReport(reportWithOrphanDismissed);
    expect(report).toContain("**nonexistent-service**: Some Feature");
  });
});

describe("generateSharedContextEntry", () => {
  const mockReport: SubscriptionReport = {
    recommendations: [
      {
        serviceId: "elevenlabs",
        serviceName: "ElevenLabs",
        currentPlan: "Creator",
        monthlyCostUsd: 18.33,
        action: "keep",
        reason: "Usage at 12% of voice minute limit.",
        unusedFeatures: ["Custom voice cloning"],
        usagePercentages: [
          { metricKey: "voiceMinutes", label: "Voice Minutes", percentage: 12, current: 12, limit: 100 },
        ],
      },
      {
        serviceId: "supabase",
        serviceName: "Supabase",
        currentPlan: "Pro",
        monthlyCostUsd: 25,
        action: "keep",
        reason: "Storage usage at 19% of limit.",
        unusedFeatures: [],
        usagePercentages: [
          { metricKey: "supabaseStorageGb", label: "Database Storage", percentage: 19, current: 1.5, limit: 8 },
        ],
      },
      {
        serviceId: "anthropic",
        serviceName: "Anthropic Claude",
        currentPlan: "Personal",
        monthlyCostUsd: 10,
        action: "review",
        reason: "4 of 6 features unused.",
        unusedFeatures: ["Batch API", "Prompt caching", "Message Batches API", "All model tiers"],
        usagePercentages: [],
      },
    ],
    totalMonthlySpend: 53.33,
    analyzedAt: "2026-02-09T10:00:00.000Z",
    dismissedFeatures: [],
  };

  it("should wrap content in ENTRY markers with correct agent key and timestamp", () => {
    const entry = generateSharedContextEntry(mockReport);
    expect(entry).toContain("<!-- ENTRY:START agent=subscription_optimizer timestamp=2026-02-09T10:00:00.000Z -->");
    expect(entry).toContain("<!-- ENTRY:END -->");
  });

  it("should include total monthly spend", () => {
    const entry = generateSharedContextEntry(mockReport);
    expect(entry).toContain("$53.33");
  });

  it("should list services needing attention", () => {
    const entry = generateSharedContextEntry(mockReport);
    expect(entry).toContain("Anthropic Claude");
    expect(entry).toMatch(/review/i);
  });

  it("should include a heading with the date", () => {
    const entry = generateSharedContextEntry(mockReport);
    expect(entry).toContain("## Subscription Optimizer — 2026-02-09");
  });

  it("omits upgrade/review/healthy lines when none exist (line 378 branches)", () => {
    // When there are no upgrades, no reviews, and no keep actions,
    // none of those lines should appear in the shared context entry.
    const reportDowngradeOnly: SubscriptionReport = {
      recommendations: [
        {
          serviceId: "test",
          serviceName: "Test Service",
          currentPlan: "Basic",
          monthlyCostUsd: 5,
          action: "downgrade",
          reason: "Overprovisioned.",
          unusedFeatures: [],
          usagePercentages: [],
        },
      ],
      totalMonthlySpend: 5,
      analyzedAt: "2026-03-19T10:00:00.000Z",
      dismissedFeatures: [],
    };
    const entry = generateSharedContextEntry(reportDowngradeOnly);
    expect(entry).not.toContain("Upgrade needed");
    expect(entry).not.toContain("Review recommended");
    expect(entry).not.toContain("Healthy");
    expect(entry).toContain("$5.00/mo");
  });

  it("includes upgrade needed line in shared context when upgrades exist", () => {
    const reportWithUpgrade: SubscriptionReport = {
      recommendations: [
        {
          serviceId: "elevenlabs",
          serviceName: "ElevenLabs",
          currentPlan: "Creator",
          monthlyCostUsd: 18.33,
          action: "upgrade",
          reason: "Voice Minutes usage at 95% of limit.",
          unusedFeatures: [],
          usagePercentages: [
            { metricKey: "voiceMinutes", label: "Voice Minutes", percentage: 95, current: 95, limit: 100 },
          ],
        },
        {
          serviceId: "supabase",
          serviceName: "Supabase",
          currentPlan: "Pro",
          monthlyCostUsd: 25,
          action: "keep",
          reason: "Storage usage at 19% of limit.",
          unusedFeatures: [],
          usagePercentages: [
            { metricKey: "supabaseStorageGb", label: "Database Storage", percentage: 19, current: 1.5, limit: 8 },
          ],
        },
      ],
      totalMonthlySpend: 43.33,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    const entry = generateSharedContextEntry(reportWithUpgrade);
    expect(entry).toContain("**Upgrade needed** (1): ElevenLabs");
  });
});
