import { RECURRING_SUBSCRIPTIONS } from "@/config/recurring-costs";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";
import type { ServiceCost } from "@/types/costs-analytics";

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate recurring subscription costs for a date range.
 * Only includes subscriptions whose active window overlaps the query period.
 */
export function generateRecurringCosts(
  startDate: string,
  endDate: string
): ServiceCost[] {
  const queryStart = new Date(startDate);
  const queryEnd = new Date(endDate);

  const costs: ServiceCost[] = [];

  for (const sub of RECURRING_SUBSCRIPTIONS) {
    const subStart = new Date(sub.startDate);
    const subEnd = sub.endDate ? new Date(sub.endDate) : null;

    // Skip if subscription hasn't started yet
    if (subStart > queryEnd) continue;

    // Skip if subscription ended before query period
    if (subEnd && subEnd < queryStart) continue;

    // Look up dashboard URL from PLATFORM_SERVICES if available
    const platformService = Object.values(PLATFORM_SERVICES).find(
      (s) => s.id === sub.serviceId
    );

    costs.push({
      serviceId: sub.serviceId,
      serviceName: sub.serviceName,
      category: sub.category,
      costUsd: sub.costUsd,
      costFormatted: formatUsd(sub.costUsd),
      source: "recurring",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      dashboardUrl: platformService?.dashboardUrl ?? sub.dashboardUrl,
      notes: sub.notes,
    });
  }

  return costs;
}
