/**
 * Subscription Optimizer — Analyzes service usage and generates recommendations.
 *
 * Compares current usage metrics against tier limits from service-tiers.ts,
 * cross-references with the service registry, and produces actionable
 * recommendations (keep / upgrade / downgrade / review).
 */

import type { ServiceRegistryEntry } from "@/config/service-registry";
import { SERVICE_TIERS, type ServiceTierConfig } from "@/config/service-tiers";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UsageMetricsInput {
  voiceMinutes: number;
  visitors: number;
  chatConversations: number;
  voiceConversations: number;
  posthogEvents: number;
  supabaseStorageGb: number;
  periodDays: number;
}

export interface DismissedFeature {
  serviceId: string;
  feature: string;
}

export interface OptimizerInput {
  services: ServiceRegistryEntry[];
  usageMetrics: UsageMetricsInput;
  dismissedFeatures: DismissedFeature[];
}

export interface UsagePercentage {
  metricKey: string;
  label: string;
  percentage: number;
  current: number;
  limit: number;
}

export interface Recommendation {
  serviceId: string;
  serviceName: string;
  currentPlan: string;
  monthlyCostUsd: number;
  action: "keep" | "upgrade" | "downgrade" | "review";
  reason: string;
  unusedFeatures: string[];
  usagePercentages: UsagePercentage[];
}

export interface SubscriptionReport {
  recommendations: Recommendation[];
  totalMonthlySpend: number;
  analyzedAt: string;
  dismissedFeatures: DismissedFeature[];
}

// ─── Metric key to usage value mapping ──────────────────────────────────────

function getMetricValue(
  metricKey: string,
  usage: UsageMetricsInput
): number | undefined {
  const mapping: Record<string, number> = {
    voiceMinutes: usage.voiceMinutes,
    visitors: usage.visitors,
    posthogEvents: usage.posthogEvents,
    supabaseStorageGb: usage.supabaseStorageGb,
  };
  return mapping[metricKey];
}

// ─── Threshold constants ────────────────────────────────────────────────────

/** Usage above this percentage triggers an upgrade recommendation */
const UPGRADE_THRESHOLD = 0.8;

/** Usage above this percentage triggers a warning/review */
const WARNING_THRESHOLD = 1.0;

// ─── Analysis ───────────────────────────────────────────────────────────────

function analyzeService(
  service: ServiceRegistryEntry,
  tierConfig: ServiceTierConfig | undefined,
  usage: UsageMetricsInput,
  dismissedFeatures: DismissedFeature[]
): Recommendation {
  const dismissedForService = dismissedFeatures
    .filter((d) => d.serviceId === service.serviceId)
    .map((d) => d.feature);

  // Calculate unused features (included - used - dismissed)
  const usedSet = new Set(service.usedFeatures ?? []);
  const dismissedSet = new Set(dismissedForService);
  const unusedFeatures = service.includedFeatures.filter(
    (f) => !usedSet.has(f) && !dismissedSet.has(f)
  );

  // Calculate usage percentages for services with tier limits
  const usagePercentages: UsagePercentage[] = [];
  let maxUsageRatio = 0;

  if (tierConfig) {
    for (const limit of tierConfig.limits) {
      const currentValue = getMetricValue(limit.metricKey, usage);
      if (currentValue !== undefined) {
        const ratio = currentValue / limit.monthlyLimit;
        const percentage = Math.round(ratio * 100);
        usagePercentages.push({
          metricKey: limit.metricKey,
          label: limit.label,
          percentage,
          current: currentValue,
          limit: limit.monthlyLimit,
        });
        if (ratio > maxUsageRatio) {
          maxUsageRatio = ratio;
        }
      }
    }
  }

  // Determine action based on usage
  let action: Recommendation["action"] = "keep";
  let reason: string;

  if (maxUsageRatio > WARNING_THRESHOLD) {
    // Over the limit
    action = "upgrade";
    const overMetric = usagePercentages.find((u) => u.percentage > 100);
    reason = overMetric
      ? `${overMetric.label} usage at ${overMetric.percentage}% of limit (${overMetric.current}/${overMetric.limit}). Exceeding current plan capacity.`
      : `Usage exceeds plan limits. Consider upgrading.`;
  } else if (maxUsageRatio > UPGRADE_THRESHOLD) {
    // Approaching the limit
    action = "upgrade";
    const nearMetric = usagePercentages.find((u) => u.percentage > 80);
    reason = nearMetric
      ? `${nearMetric.label} usage at ${nearMetric.percentage}% of limit (${nearMetric.current}/${nearMetric.limit}). Approaching plan capacity.`
      : `Usage approaching plan limits. Consider upgrading soon.`;
  } else if (unusedFeatures.length > service.includedFeatures.length / 2) {
    // More than half of features unused — worth reviewing
    action = "review";
    reason = `${unusedFeatures.length} of ${service.includedFeatures.length} plan features are unused. Consider if current plan is needed or explore unused features.`;
  } else if (usagePercentages.length > 0) {
    // Has metrics and within safe range
    const highestUsage = usagePercentages.reduce(
      (max, u) => (u.percentage > max.percentage ? u : max),
      usagePercentages[0]
    );
    reason = `${highestUsage.label} usage at ${highestUsage.percentage}% of limit. Well within current plan.`;
  } else {
    // No tier metrics — just report on feature usage
    reason =
      unusedFeatures.length > 0
        ? `Using ${(service.usedFeatures ?? []).length} of ${service.includedFeatures.length} plan features.`
        : `All plan features are in use. Good value.`;
  }

  return {
    serviceId: service.serviceId,
    serviceName: service.serviceName,
    currentPlan: service.currentPlan,
    monthlyCostUsd: service.monthlyCostUsd,
    action,
    reason,
    unusedFeatures,
    usagePercentages,
  };
}

export function analyzeSubscriptions(input: OptimizerInput): SubscriptionReport {
  const { services, usageMetrics, dismissedFeatures } = input;

  // Build a lookup for tier configs
  const tierMap = new Map<string, ServiceTierConfig>();
  for (const tier of SERVICE_TIERS) {
    tierMap.set(tier.serviceId, tier);
  }

  const recommendations = services.map((service) =>
    analyzeService(
      service,
      tierMap.get(service.serviceId),
      usageMetrics,
      dismissedFeatures
    )
  );

  const totalMonthlySpend = services.reduce(
    (sum, s) => sum + s.monthlyCostUsd,
    0
  );

  return {
    recommendations,
    totalMonthlySpend: Math.round(totalMonthlySpend * 100) / 100,
    analyzedAt: new Date().toISOString(),
    dismissedFeatures,
  };
}

// ─── Report Generation ──────────────────────────────────────────────────────

function formatAction(action: Recommendation["action"]): string {
  const labels: Record<string, string> = {
    keep: "KEEP",
    upgrade: "UPGRADE",
    downgrade: "DOWNGRADE",
    review: "REVIEW",
  };
  return labels[action] ?? action.toUpperCase();
}

function formatActionEmoji(action: Recommendation["action"]): string {
  const emojis: Record<string, string> = {
    keep: "ok",
    upgrade: "up",
    downgrade: "down",
    review: "review",
  };
  return `[${emojis[action] ?? "?"}]`;
}

export function generateReport(report: SubscriptionReport): string {
  const date = report.analyzedAt.split("T")[0];
  const lines: string[] = [];

  // Header
  lines.push("# Subscription Optimizer Report");
  lines.push(`> Week of ${date}`);
  lines.push(`> Total monthly spend: **$${report.totalMonthlySpend.toFixed(2)}**`);
  lines.push("");

  // Recommendations section
  lines.push("## Recommendations");
  lines.push("");

  const actionOrder: Recommendation["action"][] = [
    "upgrade",
    "review",
    "downgrade",
    "keep",
  ];
  const sorted = [...report.recommendations].sort(
    (a, b) => actionOrder.indexOf(a.action) - actionOrder.indexOf(b.action)
  );

  for (const rec of sorted) {
    lines.push(
      `### ${formatActionEmoji(rec.action)} ${rec.serviceName} — ${formatAction(rec.action)}`
    );
    lines.push(`- **Plan**: ${rec.currentPlan} ($${rec.monthlyCostUsd.toFixed(2)}/mo)`);
    lines.push(`- **Assessment**: ${rec.reason}`);
    if (rec.usagePercentages.length > 0) {
      lines.push("- **Usage**:");
      for (const u of rec.usagePercentages) {
        const bar = generateProgressBar(u.percentage);
        lines.push(
          `  - ${u.label}: ${u.current.toLocaleString()} / ${u.limit.toLocaleString()} (${u.percentage}%) ${bar}`
        );
      }
    }
    lines.push("");
  }

  // Usage Summary table
  lines.push("## Usage Summary");
  lines.push("");
  lines.push("| Service | Plan | Cost/mo | Action | Key Metric |");
  lines.push("|---------|------|---------|--------|------------|");

  for (const rec of sorted) {
    const keyMetric =
      rec.usagePercentages.length > 0
        ? `${rec.usagePercentages[0].percentage}% of ${rec.usagePercentages[0].label}`
        : "N/A";
    lines.push(
      `| ${rec.serviceName} | ${rec.currentPlan} | $${rec.monthlyCostUsd.toFixed(2)} | ${formatAction(rec.action)} | ${keyMetric} |`
    );
  }
  lines.push("");

  // Unused features section
  const servicesWithUnused = report.recommendations.filter(
    (r) => r.unusedFeatures.length > 0
  );
  if (servicesWithUnused.length > 0) {
    lines.push("## Unused Features Worth Exploring");
    lines.push("");
    lines.push("| Service | Feature | Effort |");
    lines.push("|---------|---------|--------|");

    for (const rec of servicesWithUnused) {
      for (const feature of rec.unusedFeatures) {
        lines.push(
          `| ${rec.serviceName} | ${feature} | Low-Medium |`
        );
      }
    }
    lines.push("");
  }

  // Dismissed features section
  if (report.dismissedFeatures.length > 0) {
    lines.push("## Features Not Applicable");
    lines.push("(Reviewed & discarded -- will not be re-suggested unless project changes)");
    lines.push("");
    for (const d of report.dismissedFeatures) {
      const service = report.recommendations.find(
        (r) => r.serviceId === d.serviceId
      );
      lines.push(
        `- **${service?.serviceName ?? d.serviceId}**: ${d.feature}`
      );
    }
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push(`*Generated by Subscription Optimizer on ${date}*`);

  return lines.join("\n");
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateProgressBar(percentage: number): string {
  const filled = Math.min(Math.round(percentage / 10), 10);
  const empty = 10 - filled;
  return `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
}
