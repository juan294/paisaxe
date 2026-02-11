// Platform Costs Analytics Types

export type CostCategory = "ai" | "infrastructure" | "communications" | "analytics" | "payments" | "development";
export type CostSource = "api" | "estimate" | "manual" | "recurring";

export interface ServiceCost {
  serviceId: string;
  serviceName: string;
  category: CostCategory;
  costUsd: number;
  costFormatted: string;
  source: CostSource;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dashboardUrl?: string;
  notes?: string;
}

export interface CostsAnalyticsSummary {
  totalMonthlyUsd: number;
  totalMonthlyFormatted: string;
  thirtyDayUsd: number;
  thirtyDayFormatted: string;
  servicesTracked: number;
  automatedServices: number;
}

export interface CostsByDay {
  date: string;
  costUsd: number;
}

export interface UsageMetrics {
  visitors: number;
  chatConversations: number;
  voiceConversations: number;
  voiceMinutes: number;
  periodDays: number;
  posthogEvents?: number;
}

export interface ForecastScenario {
  label: string;
  multiplier: number;
  visitors: number;
  chats: number;
  voiceConversations: number;
  voiceMinutes: number;
  estimatedMonthlyCost: number;
  breakdown: {
    infrastructure: number;
    ai: number;
    voice: number;
  };
}

export interface CostsAnalyticsDashboardData {
  summary: CostsAnalyticsSummary;
  services: ServiceCost[];
  costsByDay: CostsByDay[];
  dateRange: {
    from: string;
    to: string;
  };
  usageMetrics?: UsageMetrics;
}

export interface ManualCostEntry {
  id: string;
  serviceId: string;
  serviceName: string;
  category: CostCategory;
  costUsd: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateManualCostRequest {
  serviceId: string;
  serviceName: string;
  category: CostCategory;
  costUsd: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  notes?: string;
}

export interface UpdateManualCostRequest {
  costUsd?: number;
  notes?: string;
}

// Service definitions for the platform
export const PLATFORM_SERVICES = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    category: "ai" as CostCategory,
    hasApi: true,
    dashboardUrl: "https://console.anthropic.com/settings/cost",
  },
  elevenlabs: {
    id: "elevenlabs",
    name: "ElevenLabs",
    category: "ai" as CostCategory,
    hasApi: false, // Partial - we estimate from usage
    dashboardUrl: "https://elevenlabs.io/subscription",
  },
  twilio: {
    id: "twilio",
    name: "Twilio",
    category: "communications" as CostCategory,
    hasApi: true,
    dashboardUrl: "https://console.twilio.com/us1/billing/usage",
  },
  voyage: {
    id: "voyage",
    name: "Voyage AI",
    category: "ai" as CostCategory,
    hasApi: false,
    dashboardUrl: "https://dash.voyageai.com/",
  },
  supabase: {
    id: "supabase",
    name: "Supabase",
    category: "infrastructure" as CostCategory,
    hasApi: false,
    dashboardUrl: "https://supabase.com/dashboard/org/_/billing",
  },
  vercel: {
    id: "vercel",
    name: "Vercel",
    category: "infrastructure" as CostCategory,
    hasApi: false,
    dashboardUrl: "https://vercel.com/dashboard/usage",
  },
  googlePlaces: {
    id: "google-places",
    name: "Google Places",
    category: "infrastructure" as CostCategory,
    hasApi: true, // But OAuth complexity makes manual entry easier
    dashboardUrl: "https://console.cloud.google.com/billing",
  },
  openweathermap: {
    id: "openweathermap",
    name: "OpenWeatherMap",
    category: "infrastructure" as CostCategory,
    hasApi: false,
    dashboardUrl: "https://home.openweathermap.org/subscriptions",
  },
  posthog: {
    id: "posthog",
    name: "PostHog",
    category: "analytics" as CostCategory,
    hasApi: false,
    dashboardUrl: "https://app.posthog.com/organization/billing",
  },
  stripe: {
    id: "stripe",
    name: "Stripe",
    category: "payments" as CostCategory,
    hasApi: true, // Shows fees, not costs
    dashboardUrl: "https://dashboard.stripe.com/balance",
  },
  awsDomains: {
    id: "aws-domains",
    name: "AWS Domains",
    category: "infrastructure" as CostCategory,
    hasApi: false,
    dashboardUrl:
      "https://console.aws.amazon.com/route53/home#DomainListing:",
  },
  githubPro: {
    id: "github-pro",
    name: "GitHub Pro",
    category: "infrastructure" as CostCategory,
    hasApi: false,
    dashboardUrl: "https://github.com/settings/billing/summary",
  },
  claudeCodeMax: {
    id: "claude-code-max",
    name: "Claude Code Max",
    category: "development" as CostCategory,
    hasApi: false,
    dashboardUrl: "https://claude.ai/settings/billing",
  },
} as const;
