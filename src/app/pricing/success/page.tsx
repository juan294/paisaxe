"use client";

import { useEffect } from "react";
import { useVoiceAccess } from "@/hooks/use-voice-access";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { Check, Mic, RefreshCw } from "lucide-react";

export default function PricingSuccessPage() {
  const { canUseVoice, expiresAt, isLoading, refresh } = useVoiceAccess();
  const { t } = useTranslation();

  // Refresh access on mount to pick up the new purchase
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-neutral-400" />
        <p className="mt-3 text-sm text-neutral-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="relative inline-block mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
            <Check className="h-12 w-12 text-green-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
            <Mic className="h-5 w-5 text-black" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-3">
          {t("premium.success_title")}
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-white/70 mb-8">
          {t("premium.success_subtitle")}
        </p>

        {/* Expiry Info */}
        {expiresAt && (
          <div className="mb-8 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-sm text-white/60 mb-1">
              {t("premium.success_expires")}
            </p>
            <p className="text-lg font-semibold text-white">
              {expiresAt.toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}

        {/* CTA */}
        <Link
          href="/immersive"
          className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-semibold rounded-full hover:from-amber-400 hover:to-yellow-400 transition-all shadow-lg shadow-amber-500/25 text-lg"
        >
          <Mic className="h-5 w-5" />
          {t("premium.success_cta")}
        </Link>

        {/* Not showing access - retry hint */}
        {!canUseVoice && (
          <p className="mt-4 text-sm text-white/50">
            If your access is not showing, please wait a moment and refresh the
            page. It may take up to 30 seconds to process.
          </p>
        )}
      </div>
    </div>
  );
}
