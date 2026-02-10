"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

export default function CheckoutPage() {
  const { user, session, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    try {
      const response = await fetch("/api/checkout/embedded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(returnTo ? { returnTo } : {}) }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const { clientSecret } = await response.json();
      return clientSecret;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    }
  }, [returnTo]);

  // Show sign-in prompt if not authenticated
  if (!user || !session) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-xl font-semibold text-white mb-4">
            {t("premium.sign_in_to_purchase")}
          </h1>
          <button
            onClick={() => signInWithGoogle("/pricing/checkout")}
            className="w-full px-5 py-3 bg-green-500 text-black text-sm font-medium rounded-lg hover:bg-green-400 transition-colors"
          >
            {t("auth.continue_with_google")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/pricing"
            aria-label={t("premium.checkout_back_to_pricing")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="ml-3 text-sm font-medium text-neutral-400">
            {t("premium.checkout_title")}
          </h1>
        </div>
      </header>

      {/* Embedded Checkout */}
      <main className="mx-auto max-w-lg px-4 py-8">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mb-4" />
            <h2 className="text-lg font-medium text-white mb-2">
              {t("errors.generic_title")}
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              {t("errors.generic_description")}
            </p>
            <button
              onClick={() => setError(null)}
              className="px-5 py-2.5 bg-green-500 text-black text-sm font-medium rounded-lg hover:bg-green-400 transition-colors"
            >
              {t("errors.retry")}
            </button>
          </div>
        ) : (
          <div id="checkout" className="rounded-xl overflow-hidden">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </main>
    </div>
  );
}
