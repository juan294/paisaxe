import { describe, it, expect } from "vitest";
import {
  analyzeSubscriptions,
  generateReport,
  type OptimizerInput,
  type Recommendation,
  type SubscriptionReport,
} from "./subscription-optimizer";
import { SERVICE_REGISTRY } from "@/config/service-registry";

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
});
