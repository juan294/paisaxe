"use client";

import { RateLimitNotice } from "@/components/rate-limit-notice";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
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
  const { user, session, signInWithGoogle } = useAuth();
  const needsSignIn = !user || !session;
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const { canUseVoice, isAccessUnavailable, isAccessDenied, isSuspended, expiresAt, isLoading, refresh, retryAfter } = useVoiceAccess();
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const recoveryPath = returnTo
    ? `/pricing/checkout/return?${new URLSearchParams({ returnTo })}`
    : "/pricing/checkout/return";
  const immersiveHref = returnTo
    ? `/immersive?story=${encodeURIComponent(returnTo)}${canUseVoice ? "&voice=ready" : ""}`
    : "/immersive";

  const recoverAccess = async () => {
    setRecoveryFailed(false);
    try {
      if (needsSignIn) await signInWithGoogle(recoveryPath);
      else await refresh();
    } catch {
      setRecoveryFailed(true);
    }
  };

  // Refresh access on mount to pick up the new purchase
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-scene-canvas flex flex-col items-center justify-center"
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

  if (!canUseVoice) {
    return (
      <main className="min-h-screen bg-scene-canvas flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full text-center text-neutral-400">
          <h1 className="text-2xl font-semibold text-scene-white mb-4">
            {t(isAccessUnavailable || isAccessDenied ? "voice.accessUnavailable" : "premium.pending_title")}
          </h1>
          <p role="status" className="mb-6">
            {t(isSuspended ? "voice.suspended" : "premium.success_retry_hint")}
          </p>
          <RateLimitNotice retryAfter={retryAfter} onRetry={() => { void refresh(); }} />
          {recoveryFailed && <p role="alert" className="mb-4">{t("errors.generic_description")}</p>}
          {retryAfter == null && (
            <button type="button" className="mb-6 rounded-lg bg-paisaxe-green-500 px-5 py-3 text-scene-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paisaxe-green-300" onClick={() => { void recoverAccess(); }}>
              {t(needsSignIn ? "auth.continue_with_google" : "voice.checkAccess")}
            </button>
          )}
          <div className="flex flex-col gap-4 text-sm">
            <Link href={immersiveHref} className="underline">{t("accessibility.go_back")}</Link>
            <a href="mailto:support@paisaxe.es" className="underline">{t("voice.contactSupport")}</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-scene-canvas flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <RateLimitNotice retryAfter={retryAfter} onRetry={() => { void refresh(); }} />
        {/* Success Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-paisaxe-green-500/10 mb-8">
          <Check className="h-7 w-7 text-paisaxe-green-500" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-scene-white tracking-tight mb-2">
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
            <p className="text-sm font-medium text-scene-white">
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
          className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-paisaxe-green-500 text-scene-black text-sm font-medium rounded-lg hover:bg-paisaxe-green-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paisaxe-green-300 focus-visible:ring-offset-2 focus-visible:ring-offset-scene-canvas"
        >
          <Mic className="h-4 w-4" />
          {t("premium.success_cta")}
        </Link>
      </div>
    </div>
  );
}
