"use client";

import { Suspense, useEffect } from "react";
import { useVoiceAccess } from "@/hooks/use-voice-access";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Mic, RefreshCw } from "lucide-react";
import { toIntlLocale } from "@/lib/utils";

/**
 * Return page after Stripe Embedded Checkout completes.
 * Stripe redirects here with ?session_id=... after payment.
 * Checks voice access and shows confirmation.
 */
export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutReturnPageContent />
    </Suspense>
  );
}

function CheckoutReturnPageContent() {
  const { canUseVoice, expiresAt, isLoading, refresh } = useVoiceAccess();
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const immersiveHref = returnTo
    ? `/immersive?story=${encodeURIComponent(returnTo)}&voice=ready`
    : "/immersive";

  // Refresh access on mount to pick up the new purchase
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center"
      >
        <RefreshCw
          aria-hidden="true"
          className="h-5 w-5 animate-spin motion-reduce:animate-none text-neutral-500"
        />
        <p className="mt-3 text-sm text-neutral-500">
          {t("premium.loading_access")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {/* Success Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-8">
          <Check className="h-7 w-7 text-green-500" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
          {t("premium.success_title")}
        </h1>

        {/* Subtitle */}
        <p className="text-neutral-400 mb-8">
          {t("premium.success_subtitle")}
        </p>

        {/* Expiry Info */}
        {expiresAt && (
          <div className="mb-8 p-4 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 mb-1">
              {t("premium.success_expires")}
            </p>
            <p className="text-sm font-medium text-white">
              {expiresAt.toLocaleString(toIntlLocale(locale), {
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
          href={immersiveHref}
          className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-green-500 text-black text-sm font-medium rounded-lg hover:bg-green-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
        >
          <Mic className="h-4 w-4" />
          {t("premium.success_cta")}
        </Link>

        {/* Not showing access - retry hint */}
        {!canUseVoice && (
          <p className="mt-6 text-xs text-neutral-500">
            {t("premium.success_retry_hint")}
          </p>
        )}
      </div>
    </div>
  );
}
