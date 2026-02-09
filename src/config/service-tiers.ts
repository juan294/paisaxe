export type AlertLevel = "safe" | "watch" | "warning" | "critical";

export interface TierLimit {
  metricKey: string;
  label: string;
  monthlyLimit: number;
  unit: string;
}

export interface TierUpgrade {
  tierName: string;
  monthlyCostUsd: number;
  notes?: string;
}

export interface ServiceTierConfig {
  serviceId: string;
  serviceName: string;
  currentTierName: string;
  currentMonthlyCostUsd: number;
  limits: TierLimit[];
  nextTier?: TierUpgrade;
}

export const SERVICE_TIERS: ServiceTierConfig[] = [
  {
    serviceId: "elevenlabs",
    serviceName: "ElevenLabs",
    currentTierName: "Creator",
    currentMonthlyCostUsd: 18.33,
    limits: [
      {
        metricKey: "voiceMinutes",
        label: "Voice Minutes",
        monthlyLimit: 100,
        unit: "min",
      },
    ],
    nextTier: {
      tierName: "Scale",
      monthlyCostUsd: 99,
      notes: "500 min/mo, priority support, custom voice cloning",
    },
  },
  {
    serviceId: "vercel",
    serviceName: "Vercel",
    currentTierName: "Hobby",
    currentMonthlyCostUsd: 0,
    limits: [
      {
        metricKey: "visitors",
        label: "Monthly Visitors",
        monthlyLimit: 50000,
        unit: "visitors",
      },
    ],
    nextTier: {
      tierName: "Pro",
      monthlyCostUsd: 20,
      notes: "Unlimited bandwidth, team features",
    },
  },
  {
    serviceId: "posthog",
    serviceName: "PostHog",
    currentTierName: "Free",
    currentMonthlyCostUsd: 0,
    limits: [
      {
        metricKey: "posthogEvents",
        label: "Monthly Events",
        monthlyLimit: 1000000,
        unit: "events",
      },
    ],
    nextTier: {
      tierName: "Pay-as-you-go",
      monthlyCostUsd: 0,
      notes: "Usage-based pricing after 1M events",
    },
  },
  {
    serviceId: "supabase",
    serviceName: "Supabase",
    currentTierName: "Pro",
    currentMonthlyCostUsd: 25,
    limits: [
      {
        metricKey: "supabaseStorageGb",
        label: "Database Storage",
        monthlyLimit: 8,
        unit: "GB",
      },
    ],
    nextTier: {
      tierName: "Team",
      monthlyCostUsd: 599,
      notes: "SOC2, priority support, more storage",
    },
  },
];
