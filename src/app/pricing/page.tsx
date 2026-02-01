"use client";

import { useAuth } from "@/hooks/use-auth";
import { useVoiceAccess } from "@/hooks/use-voice-access";
import { useTranslation } from "@/lib/i18n";
import { createDayPassCheckoutUrl, isLemonSqueezyConfigured } from "@/lib/lemonsqueezy";
import Link from "next/link";
import { ArrowLeft, Mic, Clock, Check, RefreshCw } from "lucide-react";

export default function PricingPage() {
  const { user, session, signInWithGoogle } = useAuth();
  const { canUseVoice, isWhitelisted, expiresAt, isLoading } = useVoiceAccess();
  const { t } = useTranslation();

  const handlePurchase = () => {
    if (!user || !session) {
      signInWithGoogle("/pricing");
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
        <RefreshCw className="h-5 w-5 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/immersive"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-6">
            <Mic className="h-7 w-7 text-green-500" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
            {t("premium.pricing_title")}
          </h1>
          <p className="text-neutral-400">
            {t("premium.pricing_subtitle")}
          </p>
        </div>

        {/* Already has access */}
        {canUseVoice && (
          <div className="mb-8 p-5 rounded-xl bg-green-500/5 border border-green-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-500">
                  {isWhitelisted ? "Premium Access" : t("premium.success_subtitle")}
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
        {!canUseVoice && (
          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            {/* Price */}
            <div className="p-6 text-center border-b border-neutral-800">
              <p className="text-xs font-medium text-green-500 uppercase tracking-widest mb-3">
                Voice Pass · 24h
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
                <Mic className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                <span className="text-sm text-neutral-300">
                  {t("premium.feature_unlimited")}
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="p-6 pt-2">
              <button
                onClick={handlePurchase}
                className="w-full px-5 py-3 bg-green-500 text-black text-sm font-medium rounded-lg hover:bg-green-400 transition-colors"
              >
                {user ? t("premium.pricing_cta") : t("premium.sign_in_to_purchase")}
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
                {t("premium.faq_what_included_answer")}
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
