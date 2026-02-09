"use client";

import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { Mic, Clock, Sparkles, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoicePurchaseCTAProps {
  /** Show compact version (for inline use) */
  compact?: boolean;
  /** Story slug to return to after purchase */
  returnTo?: string;
  className?: string;
}

/**
 * Call-to-action component for voice pass purchase.
 * Navigates to embedded checkout page on paisaxe.es.
 */
export function VoicePurchaseCTA({ compact = false, returnTo, className }: VoicePurchaseCTAProps) {
  const { user, session, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const handlePurchase = () => {
    if (!user || !session) {
      signInWithGoogle();
      return;
    }

    // Navigate to embedded checkout page
    const checkoutUrl = returnTo
      ? `/pricing/checkout?returnTo=${returnTo}`
      : "/pricing/checkout";
    router.push(checkoutUrl);
  };

  if (compact) {
    return (
      <div className={cn("flex flex-col items-center gap-3 p-4", className)}>
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <Mic className="h-4 w-4" />
          <span>{t("premium.voice_locked")}</span>
        </div>
        <button
          onClick={handlePurchase}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-medium rounded-full hover:from-amber-400 hover:to-yellow-400 transition-all text-sm flex items-center gap-2"
        >
          {t("premium.get_day_pass")} - €1.99
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full p-6 text-center",
        className
      )}
    >
      {/* Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center">
          <Mic className="h-10 w-10 text-amber-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-black" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-white mb-2">
        {t("premium.voice_title")}
      </h3>

      {/* Description */}
      <p className="text-white/70 text-sm mb-6 max-w-xs">
        {t("premium.voice_description")}
      </p>

      {/* Features */}
      <div className="flex flex-col gap-2 mb-6 text-left w-full max-w-xs">
        <div className="flex items-center gap-3 text-white/80 text-sm">
          <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span>{t("premium.feature_24h")}</span>
        </div>
        <div className="flex items-center gap-3 text-white/80 text-sm">
          <MapPin className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span>{t("premium.feature_realtime")}</span>
        </div>
        <div className="flex items-center gap-3 text-white/80 text-sm">
          <Phone className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span>{t("premium.feature_booking")}</span>
        </div>
      </div>

      {/* Price */}
      <div className="mb-4">
        <span className="text-3xl font-bold text-white">€1.99</span>
        <span className="text-white/60 ml-2">{t("premium.per_day")}</span>
      </div>

      {/* CTA Button */}
      <button
        onClick={handlePurchase}
        className="w-full max-w-xs px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-semibold rounded-full hover:from-amber-400 hover:to-yellow-400 transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
      >
        {user ? t("premium.get_day_pass") : t("premium.sign_in_to_purchase")}
      </button>

      {/* Info text */}
      <p className="mt-4 text-white/50 text-xs">
        {t("premium.secure_payment")}
      </p>
    </div>
  );
}
