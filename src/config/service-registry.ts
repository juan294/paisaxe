/**
 * Service Registry — Single source of truth for all subscribed services.
 *
 * This registry is used by the subscription optimizer to:
 * 1. Inventory all subscriptions and their plan features
 * 2. Track which features we're actually using
 * 3. Identify unused features worth exploring
 * 4. Watch for promotions and changelog updates
 *
 * To add a new service: append an entry with the required fields below.
 * To mark a feature as used: add it to the `usedFeatures` array.
 */

export interface ServiceRegistryEntry {
  /** Unique identifier matching PLATFORM_SERVICES and RECURRING_SUBSCRIPTIONS */
  serviceId: string;
  /** Human-readable service name */
  serviceName: string;
  /** Current plan/tier name */
  currentPlan: string;
  /** Monthly cost in USD (0 for free tiers) */
  monthlyCostUsd: number;
  /** URL to the service's billing/subscription dashboard */
  dashboardUrl: string;
  /** URL to the service's changelog, blog, or release notes */
  changelogUrl: string;
  /** All features included in the current plan */
  includedFeatures: string[];
  /** Features we're actually using in the project (subset of includedFeatures) */
  usedFeatures?: string[];
  /** Key areas to monitor for opportunities (promotions, new features, pricing changes) */
  areasToWatch: string[];
  /** Notes about the subscription */
  notes?: string;
}

export const SERVICE_REGISTRY: ServiceRegistryEntry[] = [
  {
    serviceId: "elevenlabs",
    serviceName: "ElevenLabs",
    currentPlan: "Creator",
    monthlyCostUsd: 18.33,
    dashboardUrl: "https://elevenlabs.io/subscription",
    changelogUrl: "https://elevenlabs.io/blog",
    includedFeatures: [
      "100 voice minutes/month",
      "Professional voices",
      "Custom voice cloning",
      "API access",
      "Projects (long-form)",
      "Dubbing Studio",
    ],
    usedFeatures: [
      "100 voice minutes/month",
      "Professional voices",
      "API access",
    ],
    areasToWatch: [
      "voice quota usage",
      "new voice models",
      "API feature updates",
      "pricing changes",
      "promotions",
    ],
    notes: "Annual billing: $220/yr ($266.20 with tax). Pelayo voice agent.",
  },
  {
    serviceId: "supabase",
    serviceName: "Supabase",
    currentPlan: "Pro",
    monthlyCostUsd: 25,
    dashboardUrl: "https://supabase.com/dashboard/org/_/billing",
    changelogUrl: "https://supabase.com/blog",
    includedFeatures: [
      "8 GB database storage",
      "250 GB bandwidth",
      "100 GB file storage",
      "Edge Functions (500K invocations)",
      "Daily backups (7 days)",
      "No project pausing",
      "Email support",
      "Realtime (up to 500 concurrent)",
      "Auth (100K MAU)",
      "Branching (preview)",
    ],
    usedFeatures: [
      "8 GB database storage",
      "Auth (100K MAU)",
      "Edge Functions (500K invocations)",
      "Daily backups (7 days)",
      "No project pausing",
    ],
    areasToWatch: [
      "storage usage",
      "edge function quotas",
      "new features",
      "pricing changes",
      "launch week announcements",
    ],
    notes: "Pro plan base cost. pgvector for embeddings.",
  },
  {
    serviceId: "github-pro",
    serviceName: "GitHub Pro",
    currentPlan: "Pro",
    monthlyCostUsd: 4,
    dashboardUrl: "https://github.com/settings/billing/summary",
    changelogUrl: "https://github.blog/changelog/",
    includedFeatures: [
      "3,000 Actions minutes/month",
      "2 GB Packages storage",
      "Protected branches",
      "Multiple reviewers",
      "Code owners",
      "Pages (from private repos)",
      "Wikis",
      "Repository insights",
      "Codespaces hours",
      "GitHub Packages storage",
      "Draft pull requests",
      "Auto-merge",
    ],
    usedFeatures: [
      "3,000 Actions minutes/month",
      "Protected branches",
      "Pages (from private repos)",
      "Draft pull requests",
      "Auto-merge",
      "Repository insights",
    ],
    areasToWatch: [
      "Actions minutes usage",
      "Copilot bundled features",
      "security features",
      "new Actions features",
      "pricing changes",
    ],
    notes: "CI/CD via GitHub Actions.",
  },
  {
    serviceId: "vercel",
    serviceName: "Vercel",
    currentPlan: "Hobby",
    monthlyCostUsd: 0,
    dashboardUrl: "https://vercel.com/dashboard/usage",
    changelogUrl: "https://vercel.com/changelog",
    includedFeatures: [
      "50,000 monthly visitors",
      "100 GB bandwidth",
      "Serverless functions",
      "Edge functions",
      "Preview deployments",
      "SSL certificates",
      "Analytics (limited)",
    ],
    usedFeatures: [
      "50,000 monthly visitors",
      "Serverless functions",
      "Edge functions",
      "Preview deployments",
      "SSL certificates",
    ],
    areasToWatch: [
      "traffic growth vs limits",
      "new features",
      "pricing changes",
      "edge function updates",
      "analytics features",
    ],
  },
  {
    serviceId: "anthropic",
    serviceName: "Anthropic Claude",
    currentPlan: "Personal (Pay-as-you-go)",
    monthlyCostUsd: 10,
    dashboardUrl: "https://console.anthropic.com/settings/billing",
    changelogUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    includedFeatures: [
      "Claude API access",
      "All model tiers",
      "Prompt caching",
      "Batch API",
      "Streaming responses",
      "Message Batches API",
    ],
    usedFeatures: [
      "Claude API access",
      "Streaming responses",
    ],
    areasToWatch: [
      "new model releases",
      "prompt caching savings",
      "batch API for cost reduction",
      "pricing changes",
      "rate limit increases",
    ],
    notes:
      "Personal account — no Admin API. ~$10/mo estimated from prepaid credits.",
  },
  {
    serviceId: "aws-domains",
    serviceName: "AWS Domains",
    currentPlan: "Standard",
    monthlyCostUsd: 2.08,
    dashboardUrl:
      "https://console.aws.amazon.com/route53/home#DomainListing:",
    changelogUrl: "https://aws.amazon.com/blogs/aws/category/networking-content-delivery/amazon-route-53/",
    includedFeatures: [
      "Domain registration (paisaxe.es)",
      "Domain registration (paisaxe.com)",
      "DNS hosting",
      "DNSSEC",
      "Domain privacy",
    ],
    usedFeatures: [
      "Domain registration (paisaxe.es)",
      "Domain registration (paisaxe.com)",
      "DNS hosting",
    ],
    areasToWatch: [
      "renewal pricing",
      "transfer promotions",
      "DNSSEC setup",
    ],
    notes: "paisaxe.es ($10/yr) + paisaxe.com ($15/yr).",
  },
  {
    serviceId: "stripe",
    serviceName: "Stripe",
    currentPlan: "Pay-as-you-go",
    monthlyCostUsd: 0,
    dashboardUrl: "https://dashboard.stripe.com/balance",
    changelogUrl: "https://stripe.com/blog/engineering",
    includedFeatures: [
      "Payment processing (2.9% + 30c)",
      "Checkout sessions",
      "Webhooks",
      "Customer portal",
      "Invoicing",
      "Subscription billing",
      "Stripe Tax",
      "Radar (fraud protection)",
      "Revenue reporting",
    ],
    usedFeatures: [
      "Payment processing (2.9% + 30c)",
      "Checkout sessions",
      "Webhooks",
    ],
    areasToWatch: [
      "fee optimizations",
      "new checkout features",
      "reporting tools",
      "pricing changes",
      "regional payment methods",
    ],
    notes: "Day pass payments. No monthly fee, per-transaction pricing.",
  },
  {
    serviceId: "voyage",
    serviceName: "Voyage AI",
    currentPlan: "Pay-as-you-go",
    monthlyCostUsd: 0,
    dashboardUrl: "https://dash.voyageai.com/",
    changelogUrl: "https://blog.voyageai.com/",
    includedFeatures: [
      "voyage-3 embeddings",
      "rerank-2.5 reranking",
      "Batch embeddings",
      "512-dimension Matryoshka",
    ],
    usedFeatures: [
      "voyage-3 embeddings",
      "rerank-2.5 reranking",
      "512-dimension Matryoshka",
    ],
    areasToWatch: [
      "new embedding models",
      "pricing changes",
      "model performance improvements",
      "new reranking models",
    ],
    notes: "Used for RAG pipeline. Minimal cost at current query volume.",
  },
  {
    serviceId: "twilio",
    serviceName: "Twilio",
    currentPlan: "Pay-as-you-go",
    monthlyCostUsd: 0,
    dashboardUrl: "https://console.twilio.com/us1/billing/usage",
    changelogUrl: "https://www.twilio.com/changelog",
    includedFeatures: [
      "SMS messaging",
      "Phone number rental",
      "Programmable messaging",
      "Webhook callbacks",
      "Verify API",
    ],
    usedFeatures: [
      "SMS messaging",
      "Phone number rental",
      "Webhook callbacks",
    ],
    areasToWatch: [
      "SMS pricing per region",
      "new messaging channels (WhatsApp)",
      "bundled features",
      "volume discounts",
    ],
    notes: "SMS alerts for QA and voice booking. Low volume.",
  },
  {
    serviceId: "posthog",
    serviceName: "PostHog",
    currentPlan: "Free",
    monthlyCostUsd: 0,
    dashboardUrl: "https://app.posthog.com/organization/billing",
    changelogUrl: "https://posthog.com/changelog",
    includedFeatures: [
      "1M events/month",
      "Product analytics",
      "Session recordings (limited)",
      "Feature flags",
      "A/B testing (limited)",
      "Surveys",
    ],
    usedFeatures: [
      "1M events/month",
      "Product analytics",
    ],
    areasToWatch: [
      "event volume growth",
      "new free tier features",
      "session recording limits",
      "feature flag usage",
    ],
  },
  {
    serviceId: "google-ai-pro",
    serviceName: "Google AI Pro",
    currentPlan: "AI Pro",
    monthlyCostUsd: 0,
    dashboardUrl: "https://console.cloud.google.com/billing",
    changelogUrl: "https://cloud.google.com/release-notes",
    includedFeatures: [
      "Gemini API access",
      "Google Cloud credits",
      "Google Maps Platform credit ($10/mo)",
      "Extended API quotas",
      "Priority access to new models",
    ],
    usedFeatures: [
      "Google Maps Platform credit ($10/mo)",
    ],
    areasToWatch: [
      "bundled perks",
      "new API credits",
      "model releases",
      "pricing changes",
      "hidden benefits discovery",
    ],
    notes:
      "The $10/mo Google Cloud credit was a hidden perk discovered accidentally. Watch for similar bundled benefits.",
  },
  {
    serviceId: "claude-code-max",
    serviceName: "Claude Code Max",
    currentPlan: "Max (20x)",
    monthlyCostUsd: 200,
    dashboardUrl: "https://claude.ai/settings/billing",
    changelogUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    includedFeatures: [
      "20x Pro usage capacity",
      "Claude Code (full access)",
      "Priority model access",
      "Cowork (research preview)",
      "Maximum context windows",
    ],
    usedFeatures: [
      "20x Pro usage capacity",
      "Claude Code (full access)",
      "Priority model access",
    ],
    areasToWatch: [
      "usage limits vs actual consumption",
      "new Claude Code features",
      "plan pricing changes",
      "alternative dev tools",
    ],
    notes:
      "Primary development tool for building Paisaxe. $200/mo USD. Upgraded from Pro → Max 5x → Max 20x during project.",
  },
];
