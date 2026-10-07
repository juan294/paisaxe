/**
 * Shared pricing-tier constants for all voice pass surfaces.
 *
 * Single source of truth — import from here instead of hard-coding price
 * strings in components. Any price change only needs to happen in this file.
 *
 * Brand accent: the `paisaxe-green-*` scale in tailwind.config.ts
 *   paisaxe-green-500  (the accent, used across all conversion surfaces)
 *   paisaxe-green-400  (hover / gradient endpoint / text on dark)
 */

export type PricingTierId = "day_pass" | "weekly_pass" | "monthly_pass";

export interface PricingTier {
  /** Stripe / API tier identifier */
  id: PricingTierId;
  /** Display price string, e.g. "€1.99" */
  price: string;
  /** i18n key for the duration label */
  durationKey: string;
  /** Fallback label if the i18n key is missing */
  fallbackLabel: string;
}

/** All three voice-pass tiers, in cheapest-first order. */
export const PRICING_TIERS: PricingTier[] = [
  {
    id: "day_pass",
    price: "€1.99",
    durationKey: "premium.tier_day",
    fallbackLabel: "24 horas",
  },
  {
    id: "weekly_pass",
    price: "€4.99",
    durationKey: "premium.tier_week",
    fallbackLabel: "7 días",
  },
  {
    id: "monthly_pass",
    price: "€9.99",
    durationKey: "premium.tier_month",
    fallbackLabel: "30 días",
  },
] as const;

/** Convenience: the cheapest (default) tier. */
export const DEFAULT_TIER = PRICING_TIERS[0];

/** Convenience: the lowest price shown in range labels ("desde €X"). */
export const MIN_PRICE = PRICING_TIERS[0].price;

/**
 * Build a checkout URL that always carries an explicit `tier` parameter so
 * the checkout page knows which product to create.
 *
 * @param tier   - The selected tier id (defaults to `day_pass`).
 * @param returnTo - Optional slug / path to redirect back to after checkout.
 */
export function buildCheckoutUrl(
  tier: PricingTierId = "day_pass",
  returnTo?: string
): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  params.set("tier", tier);
  return `/pricing/checkout?${params.toString()}`;
}
