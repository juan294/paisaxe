import { describe, it, expect } from "vitest";
import {
  PRICING_TIERS,
  DEFAULT_TIER,
  MIN_PRICE,
  buildCheckoutUrl,
  type PricingTierId,
} from "./pricing";

describe("PRICING_TIERS", () => {
  it("has exactly 3 tiers", () => {
    expect(PRICING_TIERS).toHaveLength(3);
  });

  it("has the expected tier ids in cheapest-first order", () => {
    expect(PRICING_TIERS.map((t) => t.id)).toEqual([
      "day_pass",
      "weekly_pass",
      "monthly_pass",
    ]);
  });

  it("has the correct prices for each tier", () => {
    expect(PRICING_TIERS[0].price).toBe("€1.99");
    expect(PRICING_TIERS[1].price).toBe("€4.99");
    expect(PRICING_TIERS[2].price).toBe("€9.99");
  });

  it("has i18n keys for every tier", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.durationKey).toMatch(/^premium\./);
      expect(tier.fallbackLabel).toBeTruthy();
    }
  });

  it("has Spanish fallback labels", () => {
    expect(PRICING_TIERS[0].fallbackLabel).toBe("24 horas");
    expect(PRICING_TIERS[1].fallbackLabel).toBe("7 días");
    expect(PRICING_TIERS[2].fallbackLabel).toBe("30 días");
  });
});

describe("DEFAULT_TIER", () => {
  it("is the day_pass tier", () => {
    expect(DEFAULT_TIER.id).toBe("day_pass");
  });

  it("is the same object reference as PRICING_TIERS[0]", () => {
    expect(DEFAULT_TIER).toBe(PRICING_TIERS[0]);
  });
});

describe("MIN_PRICE", () => {
  it("equals the day_pass price", () => {
    expect(MIN_PRICE).toBe("€1.99");
  });
});

describe("buildCheckoutUrl", () => {
  it("always includes a tier param", () => {
    const url = buildCheckoutUrl("day_pass");
    expect(url).toContain("tier=day_pass");
  });

  it("defaults to day_pass when no tier is given", () => {
    const url = buildCheckoutUrl();
    expect(url).toContain("tier=day_pass");
  });

  it("includes the correct tier for weekly_pass", () => {
    const url = buildCheckoutUrl("weekly_pass");
    expect(url).toContain("tier=weekly_pass");
  });

  it("includes the correct tier for monthly_pass", () => {
    const url = buildCheckoutUrl("monthly_pass");
    expect(url).toContain("tier=monthly_pass");
  });

  it("includes returnTo when provided", () => {
    const url = buildCheckoutUrl("day_pass", "oviedo-walking-tour");
    expect(url).toContain("returnTo=oviedo-walking-tour");
    expect(url).toContain("tier=day_pass");
  });

  it("omits returnTo when not provided", () => {
    const url = buildCheckoutUrl("day_pass");
    expect(url).not.toContain("returnTo");
  });

  it("URL-encodes the returnTo value", () => {
    const url = buildCheckoutUrl("day_pass", "oviedo/walking tour");
    expect(url).toContain("returnTo=oviedo%2Fwalking+tour");
  });

  it("returns a path starting with /pricing/checkout", () => {
    const url = buildCheckoutUrl("day_pass");
    expect(url).toMatch(/^\/pricing\/checkout\?/);
  });

  it("accepts all valid PricingTierIds", () => {
    const ids: PricingTierId[] = ["day_pass", "weekly_pass", "monthly_pass"];
    for (const id of ids) {
      expect(buildCheckoutUrl(id)).toContain(`tier=${id}`);
    }
  });
});
