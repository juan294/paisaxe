"use client";

import { useAuth } from "@/hooks/use-auth";
import { useVoiceAccess } from "@/hooks/use-voice-access";
import { useTranslation } from "@/lib/i18n";
import { createDayPassCheckoutUrl, isLemonSqueezyConfigured } from "@/lib/lemonsqueezy";
import Link from "next/link";
import { ArrowLeft, Mic, Clock, Sparkles, Check, HelpCircle, RefreshCw } from "lucide-react";

export default function PricingPage() {
  const { user, session, signInWithGoogle } = useAuth();
  const { canUseVoice, isWhitelisted, expiresAt, isLoading } = useVoiceAccess();
  const { t } = useTranslation();

  const handlePurchase = () => {
    if (!user || !session) {
      signInWithGoogle();
      return;
    }

    if (!isLemonSqueezyConfigured()) {
      console.error("[pricing] Lemon Squeezy not configured");
      return;
    }

    const successUrl = `${window.location.origin}/pricing/success`;

    const checkoutUrl = createDayPassCheckoutUrl({
      userId: user.id,
      userEmail: user.email ?? "",
      successUrl,
    });

    window.location.href = checkoutUrl;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-neutral-400" />
        <p className="mt-3 text-sm text-neutral-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/immersive"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          {/* Icon */}
          <div className="relative inline-block mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center">
              <Mic className="h-12 w-12 text-amber-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-black" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            {t("premium.pricing_title")}
          </h1>
          <p className="text-lg text-white/70 max-w-md mx-auto">
            {t("premium.pricing_subtitle")}
          </p>
        </div>

        {/* Already has access */}
        {canUseVoice && (
          <div className="mb-8 p-6 rounded-2xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-green-400">
                  {isWhitelisted ? "Premium Access" : t("premium.success_subtitle")}
                </p>
                {expiresAt && (
                  <p className="text-sm text-green-400/70">
                    {t("premium.success_expires")}{" "}
                    {expiresAt.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/immersive"
              className="inline-flex items-center justify-center w-full px-6 py-3 bg-green-500 text-black font-semibold rounded-full hover:bg-green-400 transition-all"
            >
              {t("premium.success_cta")}
            </Link>
          </div>
        )}

        {/* Pricing Card */}
        {!canUseVoice && (
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-3xl border border-neutral-800 overflow-hidden">
            {/* Header */}
            <div className="p-8 text-center border-b border-neutral-800">
              <p className="text-sm font-medium text-amber-400 uppercase tracking-wider mb-2">
                Day Pass
              </p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold text-white">€1.99</span>
                <span className="text-white/60">{t("premium.per_day")}</span>
              </div>
            </div>

            {/* Features */}
            <div className="p-8 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">
                    {t("premium.feature_24h")}
                  </p>
                  <p className="text-sm text-white/60">
                    Perfect for trip planning
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Mic className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">
                    {t("premium.feature_unlimited")}
                  </p>
                  <p className="text-sm text-white/60">
                    Pelayo and all AI guides
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="p-8 pt-0">
              <button
                onClick={handlePurchase}
                className="w-full px-6 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-semibold rounded-full hover:from-amber-400 hover:to-yellow-400 transition-all shadow-lg shadow-amber-500/25 text-lg"
              >
                {user ? t("premium.pricing_cta") : t("premium.sign_in_to_purchase")}
              </button>
              <p className="mt-4 text-center text-sm text-white/50">
                {t("premium.secure_payment")}
              </p>
            </div>
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-12 pt-8 border-t border-neutral-800">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-6">
            <HelpCircle className="h-5 w-5 text-amber-400" />
            {t("premium.faq_title")}
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-white mb-1">
                {t("premium.faq_what_included")}
              </h3>
              <p className="text-white/60 text-sm">
                {t("premium.faq_what_included_answer")}
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-1">
                {t("premium.faq_how_long")}
              </h3>
              <p className="text-white/60 text-sm">
                {t("premium.faq_how_long_answer")}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
