import type { AlertLevel, ServiceTierConfig } from "@/config/service-tiers";

export interface TierAlert {
  serviceId: string;
  serviceName: string;
  currentTierName: string;
  metricLabel: string;
  currentUsage: number;
  monthlyLimit: number;
  unit: string;
  usagePercent: number;
  dailyRate: number;
  projectedDaysToLimit: number | null;
  projectedDate: string | null;
  alertLevel: AlertLevel;
  recommendation?: {
    tierName: string;
    monthlyCostUsd: number;
    costDelta: number;
  };
}

const ALERT_THRESHOLDS = {
  critical: 7,
  warning: 30,
  watch: 90,
} as const;

/**
 * Compute tier upgrade alerts based on current usage and growth rate.
 *
 * Uses linear extrapolation: dailyRate = currentUsage / periodDays,
 * then projects when monthly usage will hit the tier limit.
 */
export function computeTierAlerts(
  tiers: ServiceTierConfig[],
  usageData: Record<string, number>,
  periodDays: number,
  referenceDate?: Date
): TierAlert[] {
  const now = referenceDate ?? new Date();
  const safePeriodDays = Math.max(periodDays, 1);

  const alerts: TierAlert[] = [];

  for (const tier of tiers) {
    for (const limit of tier.limits) {
      const currentUsage = usageData[limit.metricKey] ?? 0;
      const dailyRate = currentUsage / safePeriodDays;
      const monthlyUsage = dailyRate * 30;
      const usagePercent =
        limit.monthlyLimit > 0
          ? Math.min((monthlyUsage / limit.monthlyLimit) * 100, 100)
          : 0;

      let projectedDaysToLimit: number | null = null;
      let projectedDate: string | null = null;
      let alertLevel: AlertLevel = "safe";

      if (dailyRate > 0 && limit.monthlyLimit > 0) {
        const remaining = limit.monthlyLimit - monthlyUsage;

        if (remaining <= 0) {
          projectedDaysToLimit = 0;
          projectedDate = now.toISOString().split("T")[0];
          alertLevel = "critical";
        } else {
          projectedDaysToLimit = Math.ceil(remaining / dailyRate);
          const projected = new Date(now);
          projected.setDate(projected.getDate() + projectedDaysToLimit);
          projectedDate = projected.toISOString().split("T")[0];

          if (projectedDaysToLimit < ALERT_THRESHOLDS.critical) {
            alertLevel = "critical";
          } else if (projectedDaysToLimit < ALERT_THRESHOLDS.warning) {
            alertLevel = "warning";
          } else if (projectedDaysToLimit < ALERT_THRESHOLDS.watch) {
            alertLevel = "watch";
          }
        }
      }

      const alert: TierAlert = {
        serviceId: tier.serviceId,
        serviceName: tier.serviceName,
        currentTierName: tier.currentTierName,
        metricLabel: limit.label,
        currentUsage: Math.round(monthlyUsage * 10) / 10,
        monthlyLimit: limit.monthlyLimit,
        unit: limit.unit,
        usagePercent: Math.round(usagePercent * 10) / 10,
        dailyRate: Math.round(dailyRate * 100) / 100,
        projectedDaysToLimit,
        projectedDate,
        alertLevel,
      };

      if (tier.nextTier && (alertLevel === "warning" || alertLevel === "critical")) {
        alert.recommendation = {
          tierName: tier.nextTier.tierName,
          monthlyCostUsd: tier.nextTier.monthlyCostUsd,
          costDelta: tier.nextTier.monthlyCostUsd - tier.currentMonthlyCostUsd,
        };
      }

      alerts.push(alert);
    }
  }

  const levelOrder: Record<AlertLevel, number> = {
    critical: 0,
    warning: 1,
    watch: 2,
    safe: 3,
  };

  alerts.sort((a, b) => levelOrder[a.alertLevel] - levelOrder[b.alertLevel]);

  return alerts;
}
