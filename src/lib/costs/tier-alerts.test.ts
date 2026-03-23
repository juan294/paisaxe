import { describe, it, expect } from "vitest";
import { computeTierAlerts } from "./tier-alerts";
import { SERVICE_TIERS } from "@/config/service-tiers";
import type { ServiceTierConfig } from "@/config/service-tiers";

describe("computeTierAlerts", () => {
  const refDate = new Date("2026-02-06");

  it("should return alerts for all configured tier limits", () => {
    const totalLimits = SERVICE_TIERS.reduce(
      (sum, t) => sum + t.limits.length,
      0
    );
    const alerts = computeTierAlerts(SERVICE_TIERS, {}, 30, refDate);
    expect(alerts).toHaveLength(totalLimits);
  });

  it("should return safe for zero usage", () => {
    const alerts = computeTierAlerts(SERVICE_TIERS, {}, 30, refDate);
    for (const alert of alerts) {
      expect(alert.alertLevel).toBe("safe");
      expect(alert.projectedDaysToLimit).toBeNull();
    }
  });

  it("should return critical when usage exceeds limit", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 100, unit: "calls" },
        ],
        nextTier: { tierName: "Pro", monthlyCostUsd: 10 },
      },
    ];

    // 200 usage in 30 days = 200/month > 100 limit
    const alerts = computeTierAlerts(
      tiers,
      { testMetric: 200 },
      30,
      refDate
    );

    expect(alerts[0].alertLevel).toBe("critical");
    expect(alerts[0].projectedDaysToLimit).toBe(0);
  });

  it("should return critical via projection when limit hit in less than 7 days", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 100, unit: "calls" },
        ],
        nextTier: { tierName: "Pro", monthlyCostUsd: 10 },
      },
    ];

    // 95 usage in 30 days = 95/month, remaining = 5, daily = 95/30 ≈ 3.17
    // daysToLimit = ceil(5 / 3.17) = 2 → critical (< 7)
    const alerts = computeTierAlerts(
      tiers,
      { testMetric: 95 },
      30,
      refDate
    );

    expect(alerts[0].alertLevel).toBe("critical");
    expect(alerts[0].projectedDaysToLimit).toBeGreaterThan(0);
    expect(alerts[0].projectedDaysToLimit).toBeLessThan(7);
    expect(alerts[0].recommendation).toBeDefined();
  });

  it("should return warning when limit hit in 7-30 days", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 100, unit: "calls" },
        ],
        nextTier: { tierName: "Pro", monthlyCostUsd: 10 },
      },
    ];

    // 80 usage in 30 days = 80/month, remaining = 20, daily = 80/30 ≈ 2.67
    // daysToLimit = 20 / 2.67 ≈ 8 days → warning
    const alerts = computeTierAlerts(
      tiers,
      { testMetric: 80 },
      30,
      refDate
    );

    expect(alerts[0].alertLevel).toBe("warning");
    expect(alerts[0].projectedDaysToLimit).toBeGreaterThanOrEqual(7);
    expect(alerts[0].projectedDaysToLimit).toBeLessThan(30);
  });

  it("should return watch when limit hit in 30-90 days", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 1000, unit: "calls" },
        ],
      },
    ];

    // 600 usage in 30 days = 600/month, remaining = 400, daily = 20
    // daysToLimit = 400 / 20 = 20 → but wait, 600/month < 1000 limit
    // remaining = 1000 - 600 = 400, daily = 600/30 = 20
    // days = 400 / 20 = 20 → warning (< 30)
    // Need: remaining / daily to be 30-90
    // 500 in 30 days = 500/month, daily = 500/30 ≈ 16.67
    // remaining = 1000 - 500 = 500
    // days = 500 / 16.67 = 30 → watch
    const alerts = computeTierAlerts(
      tiers,
      { testMetric: 500 },
      30,
      refDate
    );

    expect(alerts[0].alertLevel).toBe("watch");
    expect(alerts[0].projectedDaysToLimit).toBeGreaterThanOrEqual(30);
    expect(alerts[0].projectedDaysToLimit).toBeLessThan(90);
  });

  it("should return safe when limit is far away", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 10000, unit: "calls" },
        ],
      },
    ];

    // 100 in 30 days = 100/month, daily = 100/30 ≈ 3.33
    // remaining = 10000 - 100 = 9900
    // days = 9900 / 3.33 = 2970 → safe
    const alerts = computeTierAlerts(
      tiers,
      { testMetric: 100 },
      30,
      refDate
    );

    expect(alerts[0].alertLevel).toBe("safe");
    expect(alerts[0].projectedDaysToLimit).toBeGreaterThanOrEqual(90);
  });

  it("should handle zero periodDays without crashing", () => {
    const alerts = computeTierAlerts(
      SERVICE_TIERS,
      { voiceMinutes: 10 },
      0,
      refDate
    );
    expect(alerts).toBeDefined();
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("should include upgrade recommendation for warning/critical alerts", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 100, unit: "calls" },
        ],
        nextTier: { tierName: "Pro", monthlyCostUsd: 10 },
      },
    ];

    const alerts = computeTierAlerts(
      tiers,
      { testMetric: 200 },
      30,
      refDate
    );

    expect(alerts[0].recommendation).toBeDefined();
    expect(alerts[0].recommendation!.tierName).toBe("Pro");
    expect(alerts[0].recommendation!.monthlyCostUsd).toBe(10);
    expect(alerts[0].recommendation!.costDelta).toBe(10);
  });

  it("should NOT include recommendation for safe/watch alerts", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 10000, unit: "calls" },
        ],
        nextTier: { tierName: "Pro", monthlyCostUsd: 10 },
      },
    ];

    const alerts = computeTierAlerts(
      tiers,
      { testMetric: 1 },
      30,
      refDate
    );

    expect(alerts[0].recommendation).toBeUndefined();
  });

  it("should sort by severity (critical first)", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "safe-service",
        serviceName: "Safe",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "safeMetric", label: "Safe", monthlyLimit: 10000, unit: "calls" },
        ],
      },
      {
        serviceId: "critical-service",
        serviceName: "Critical",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "critMetric", label: "Critical", monthlyLimit: 100, unit: "calls" },
        ],
      },
    ];

    const alerts = computeTierAlerts(
      tiers,
      { safeMetric: 1, critMetric: 200 },
      30,
      refDate
    );

    expect(alerts[0].alertLevel).toBe("critical");
    expect(alerts[1].alertLevel).toBe("safe");
  });

  it("should default to current date when referenceDate is omitted", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 100, unit: "calls" },
        ],
      },
    ];

    // Should not throw and should return valid alerts
    const alerts = computeTierAlerts(tiers, { testMetric: 50 }, 30);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertLevel).toBeDefined();
  });

  it("should return 0 usagePercent when monthlyLimit is 0", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 0, unit: "calls" },
        ],
      },
    ];

    const alerts = computeTierAlerts(tiers, { testMetric: 50 }, 30, refDate);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].usagePercent).toBe(0);
  });

  it("should compute correct projected date", () => {
    const tiers: ServiceTierConfig[] = [
      {
        serviceId: "test",
        serviceName: "Test",
        currentTierName: "Free",
        currentMonthlyCostUsd: 0,
        limits: [
          { metricKey: "testMetric", label: "Test", monthlyLimit: 100, unit: "calls" },
        ],
      },
    ];

    // 80 in 30 days: monthly = 80, remaining = 20, daily = 80/30 ≈ 2.67
    // days = ceil(20 / 2.67) = 8
    const alerts = computeTierAlerts(
      tiers,
      { testMetric: 80 },
      30,
      refDate
    );

    expect(alerts[0].projectedDate).toBeTruthy();
    const projected = new Date(alerts[0].projectedDate!);
    expect(projected.getTime()).toBeGreaterThan(refDate.getTime());
  });
});
