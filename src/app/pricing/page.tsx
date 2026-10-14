"use client";

import { interpolate } from "@/lib/i18n/interpolate";

import { RateLimitNotice } from "@/components/rate-limit-notice";

import { Suspense, useCallback, useState } from "react";
import { useRovingTabIndex } from "@/hooks/use-roving-tab-index";
import { useAuth } from "@/hooks/use-auth";
import { useVoiceAccess } from "@/hooks/use-voice-access";
import { useTranslation } from "@/lib/i18n";
import PricingLoading from "./loading";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Check, RefreshCw, Phone, MapPin } from "lucide-react";
import { PRICING_TIERS, buildCheckoutUrl, type PricingTier, type PricingTierId } from "@/lib/pricing";
import { toIntlLocale } from "@/lib/utils";

/**
 * Resolve the human-readable duration for a pricing tier, translated via
 * `t(tier.durationKey)`. Falls back to `tier.fallbackLabel` only when the
 * key is missing from the active locale (survives a locale shipping late).
 */
function resolveTierDuration(t: (key: string) => string, tier: PricingTier): string {
  const translated = t(tier.durationKey);
  return translated === tier.durationKey ? tier.fallbackLabel : translated;
}

/** UX-H4 (#890): allowlist check for a `tier` query param — never a passthrough. */
function isValidTierId(value: string | null): value is PricingTierId {
  return PRICING_TIERS.some((tier) => tier.id === value);
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingLoading />}>
      <PricingPageContent />
    </Suspense>
  );
}

function PricingPageContent() {
  const { user, session, signInWithGoogle } = useAuth();
  const { canUseVoice, isWhitelisted, expiresAt, isLoading, retryAfter, refresh } = useVoiceAccess();
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const returnTo = searchParams.get("returnTo");
  const isResolvingAuthenticatedAccess = isLoading && !!user && !!session;

  // #137: selected pass tier — defaults to the Day Pass. UX-H4 (#890): seeded
  // from the `tier` query param so a sign-in round trip (which lands back on
  // this same route via signInWithGoogle's redirect) doesn't silently reset
  // the user's choice back to the Day Pass.
  const tierParam = searchParams.get("tier");
  const [selectedTier, setSelectedTier] = useState<PricingTierId>(
    isValidTierId(tierParam) ? tierParam : "day_pass"
  );
  const selectedTierData =
    PRICING_TIERS.find((tier) => tier.id === selectedTier) ?? PRICING_TIERS[0];

  const { itemRefs: tierRefs, getTabIndex, focusForKey } = useRovingTabIndex({
    count: PRICING_TIERS.length,
    activeIndex: PRICING_TIERS.findIndex((tier) => tier.id === selectedTier),
    orientation: "both",
  });
  const handleTierKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const next = focusForKey(event.key, index);
      if (next === null) return;
      const tier = PRICING_TIERS[next];
      if (!tier) return;
      event.preventDefault();
      setSelectedTier(tier.id);
    },
    [focusForKey]
  );
  // UX-B1 (#886): the section label, feature bullet, and FAQ answer must
  // describe the *selected* tier's duration — not be hardcoded to the Day
  // Pass's "24 horas" regardless of which tier the user picked.
  const selectedTierDuration = resolveTierDuration(t, selectedTierData);
  const voicePassLabel = interpolate(t("premium.voice_pass_label"), { duration: selectedTierDuration });

  // UX-H4 (#890): carry both `returnTo` and the selected `tier` through the
  // sign-in redirect so the tier survives the OAuth round trip back to /pricing.
  const pricingParams = new URLSearchParams();
  if (returnTo) pricingParams.set("returnTo", returnTo);
  pricingParams.set("tier", selectedTier);
  const pricingUrl = `/pricing?${pricingParams.toString()}`;

  const checkoutUrl = buildCheckoutUrl(selectedTier, returnTo ?? undefined);

  const handlePurchase = () => {
    if (!user || !session) {
      signInWithGoogle(pricingUrl);
      return;
    }

    router.push(checkoutUrl);
  };

  return (
    <div className="min-h-screen bg-scene-canvas">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-scene-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/immersive"
            aria-label={t("accessibility.go_back")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-scene-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        <RateLimitNotice retryAfter={retryAfter} onRetry={() => { void refresh(); }} />
        {/* Hero */}
        <div className="text-center mb-12">
          {/* Animated sound bars */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-paisaxe-green-500/10 mb-6">
            <div className="flex items-center justify-center gap-[3px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-paisaxe-green-500 animate-soundbar"
                  style={{
                    height: [12, 18, 24, 18, 12][i],
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-scene-white tracking-tight mb-2">
            {t("premium.pricing_title")}
          </h1>
          <p className="text-neutral-400">
            {t("premium.pricing_subtitle")}
          </p>
        </div>

        {/* Already has access */}
        {!isResolvingAuthenticatedAccess && canUseVoice && (
          <div className="mb-8 p-5 rounded-xl bg-paisaxe-green-500/5 border border-paisaxe-green-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-paisaxe-green-500/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-paisaxe-green-500" />
              </div>
              <div>
                <p className="font-medium text-paisaxe-green-500">
                  {isWhitelisted ? t("premium.premium_access") : t("premium.success_subtitle")}
                </p>
                {expiresAt && (
                  <p className="text-xs text-paisaxe-green-500/60">
                    {t("premium.success_expires")} {expiresAt.toLocaleString(toIntlLocale(locale))}
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/immersive"
              className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-paisaxe-green-500 text-scene-black text-sm font-medium rounded-lg hover:bg-paisaxe-green-400 transition-colors"
            >
              {t("premium.success_cta")}
            </Link>
          </div>
        )}

        {/* Pricing Card */}
        {retryAfter == null && (!canUseVoice || isResolvingAuthenticatedAccess) && (
          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            {/* Price + tier selector (#137) */}
            <div className="p-6 text-center border-b border-neutral-800">
              <p className="text-xs font-medium text-paisaxe-green-500 uppercase tracking-widest mb-4">
                {voicePassLabel}
              </p>
              <div
                role="radiogroup"
                aria-label={voicePassLabel}
                className="grid grid-cols-3 gap-2"
              >
                {PRICING_TIERS.map((tier, index) => {
                  const selected = selectedTier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      ref={(el) => { tierRefs.current[index] = el; }}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={getTabIndex(index)}
                      onClick={() => setSelectedTier(tier.id)}
                      onKeyDown={(e) => handleTierKeyDown(e, index)}
                      className={`flex flex-col items-center rounded-lg border px-2 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paisaxe-green-300 ${
                        selected
                          ? "border-paisaxe-green-500 bg-paisaxe-green-500/10"
                          : "border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <span className="text-lg font-semibold text-scene-white">
                        {tier.price}
                      </span>
                      <span className="mt-1 text-[11px] text-neutral-400">
                        {resolveTierDuration(t, tier)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Features */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                <span className="text-sm text-neutral-300">
                  {interpolate(t("premium.feature_duration"), { duration: selectedTierDuration })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                <span className="text-sm text-neutral-300">
                  {t("premium.feature_booking")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                <span className="text-sm text-neutral-300">
                  {t("premium.feature_realtime")}
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="p-6 pt-2">
              <button
                onClick={handlePurchase}
                disabled={isResolvingAuthenticatedAccess}
                className="w-full px-5 py-3 bg-gradient-to-r from-paisaxe-green-500 to-paisaxe-green-400 text-scene-black text-sm font-medium rounded-lg hover:from-paisaxe-green-400 hover:to-paisaxe-green-300 transition-colors flex items-center justify-center gap-2 disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-75 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paisaxe-green-300 focus-visible:ring-offset-2 focus-visible:ring-offset-scene-canvas"
              >
                {isResolvingAuthenticatedAccess ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : user ? (
                  t("premium.pricing_cta")
                ) : (
                  t("premium.sign_in_to_purchase")
                )}
              </button>
              <p className="mt-3 text-center text-xs text-neutral-500">
                {t("premium.secure_payment")}
              </p>
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="mt-12 pt-8 border-t border-neutral-800/50">
          <h2 className="text-sm font-medium text-neutral-400 mb-6">
            {t("premium.faq_title")}
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className="text-sm text-scene-white mb-1">
                {t("premium.faq_what_included")}
              </h3>
              <p className="text-xs text-neutral-500">
                {t("premium.faq_what_included_answer")}{" "}
                <strong className="text-neutral-300">{t("premium.faq_what_included_highlight")}</strong>
              </p>
            </div>
            <div>
              <h3 className="text-sm text-scene-white mb-1">
                {t("premium.faq_how_long")}
              </h3>
              <p className="text-xs text-neutral-500">
                {interpolate(t("premium.faq_how_long_answer"), { duration: selectedTierDuration })}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
