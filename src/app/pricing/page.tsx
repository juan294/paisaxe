"use client";

import { Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useVoiceAccess } from "@/hooks/use-voice-access";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Check, RefreshCw, Phone, MapPin } from "lucide-react";

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingPageContent />
    </Suspense>
  );
}

function PricingPageContent() {
  const { user, session, signInWithGoogle } = useAuth();
  const { canUseVoice, isWhitelisted, expiresAt, isLoading } = useVoiceAccess();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const returnTo = searchParams.get("returnTo");
  const isResolvingAuthenticatedAccess = isLoading && !!user && !!session;

  const handlePurchase = () => {
    if (!user || !session) {
      signInWithGoogle("/pricing");
      return;
    }

    // Navigate to embedded checkout page
    const checkoutUrl = returnTo
      ? `/pricing/checkout?returnTo=${returnTo}`
      : "/pricing/checkout";
    router.push(checkoutUrl);
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/immersive"
            aria-label={t("accessibility.go_back")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          {/* Animated sound bars */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-6">
            <div className="flex items-center justify-center gap-[3px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-green-500 animate-soundbar"
                  style={{
                    height: [12, 18, 24, 18, 12][i],
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-white tracking-tight mb-2">
            {t("premium.pricing_title")}
          </h1>
          <p className="text-neutral-400">
            {t("premium.pricing_subtitle")}
          </p>
        </div>

        {/* Already has access */}
        {!isResolvingAuthenticatedAccess && canUseVoice && (
          <div className="mb-8 p-5 rounded-xl bg-green-500/5 border border-green-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-500">
                  {isWhitelisted ? t("premium.premium_access") : t("premium.success_subtitle")}
                </p>
                {expiresAt && (
                  <p className="text-xs text-green-500/60">
                    {t("premium.success_expires")} {expiresAt.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/immersive"
              className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-green-500 text-black text-sm font-medium rounded-lg hover:bg-green-400 transition-colors"
            >
              {t("premium.success_cta")}
            </Link>
          </div>
        )}

        {/* Pricing Card */}
        {(!canUseVoice || isResolvingAuthenticatedAccess) && (
          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            {/* Price */}
            <div className="p-6 text-center border-b border-neutral-800">
              <p className="text-xs font-medium text-green-500 uppercase tracking-widest mb-3">
                {t("premium.voice_pass_label")}
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-semibold text-white">€1.99</span>
              </div>
            </div>

            {/* Features */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                <span className="text-sm text-neutral-300">
                  {t("premium.feature_24h")}
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
                className="w-full px-5 py-3 bg-gradient-to-r from-green-500 to-green-400 text-black text-sm font-medium rounded-lg hover:from-green-400 hover:to-green-300 transition-colors flex items-center justify-center gap-2 disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-75 disabled:cursor-not-allowed"
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
              <h3 className="text-sm text-white mb-1">
                {t("premium.faq_what_included")}
              </h3>
              <p className="text-xs text-neutral-500">
                {t("premium.faq_what_included_answer")}{" "}
                <strong className="text-neutral-300">{t("premium.faq_what_included_highlight")}</strong>
              </p>
            </div>
            <div>
              <h3 className="text-sm text-white mb-1">
                {t("premium.faq_how_long")}
              </h3>
              <p className="text-xs text-neutral-500">
                {t("premium.faq_how_long_answer")}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
