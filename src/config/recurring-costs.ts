import type { CostCategory } from "@/types/costs-analytics";

export interface RecurringSubscription {
  serviceId: string;
  serviceName: string;
  category: CostCategory;
  costUsd: number;
  billingCycle: "monthly";
  notes: string;
  dashboardUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD, undefined = ongoing
}

export const RECURRING_SUBSCRIPTIONS: RecurringSubscription[] = [
  {
    serviceId: "supabase",
    serviceName: "Supabase",
    category: "infrastructure",
    costUsd: 25,
    billingCycle: "monthly",
    notes: "Pro plan base cost",
    dashboardUrl: "https://supabase.com/dashboard/org/_/billing",
    startDate: "2025-01-01",
  },
  {
    serviceId: "elevenlabs",
    serviceName: "ElevenLabs",
    category: "ai",
    costUsd: 5,
    billingCycle: "monthly",
    notes: "Starter plan base cost",
    dashboardUrl: "https://elevenlabs.io/subscription",
    startDate: "2026-02-01",
  },
  {
    serviceId: "aws-domains",
    serviceName: "AWS Domains",
    category: "infrastructure",
    costUsd: 2.08,
    billingCycle: "monthly",
    notes: "paisaxe.es ($10/yr) + paisaxe.com ($15/yr)",
    dashboardUrl:
      "https://console.aws.amazon.com/route53/home#DomainListing:",
    startDate: "2025-01-01",
  },
  {
    serviceId: "github-pro",
    serviceName: "GitHub Pro",
    category: "infrastructure",
    costUsd: 4,
    billingCycle: "monthly",
    notes: "Pro plan for CI/CD minutes and features",
    dashboardUrl: "https://github.com/settings/billing/summary",
    startDate: "2026-02-06",
  },
  {
    serviceId: "anthropic",
    serviceName: "Anthropic Claude",
    category: "ai",
    costUsd: 10,
    billingCycle: "monthly",
    notes: "Prepaid credits (API + Claude Code + agents). ~$10/mo estimated",
    dashboardUrl: "https://console.anthropic.com/settings/billing",
    startDate: "2025-12-15",
  },
];
