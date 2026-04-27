"use client";

import { Cloud, Phone, Clock, Zap, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UpsellReason } from "@/lib/chat-upsell-detection";

interface ChatUpsellCTAProps {
  /** The reason that triggered this upsell */
  reason: UpsellReason;
  /** Called when user dismisses the CTA */
  onDismiss: () => void;
  /** Additional CSS classes */
  className?: string;
}

/** Icon component mapping for each upsell reason */
const REASON_ICONS: Record<UpsellReason, typeof Cloud> = {
  weather: Cloud,
  booking: Phone,
  realtime: Clock,
  slow_typing: Zap,
};

/**
 * Contextual upsell CTA shown inline after chat messages.
 * Displays different messaging based on the trigger reason.
 */
export function ChatUpsellCTA({ reason, onDismiss, className }: ChatUpsellCTAProps) {
  const { user, session, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const Icon = REASON_ICONS[reason];

  const handlePurchase = () => {
    if (!user || !session) {
      signInWithGoogle();
      return;
    }

    // Navigate to embedded checkout page
    router.push("/pricing/checkout");
  };

  return (
    <div
      className={cn(
        "mx-4 mb-4 rounded-xl overflow-hidden",
        "bg-gradient-to-r from-amber-500/20 to-yellow-500/20",
        "border border-amber-500/30",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
        className
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Icon className="h-4 w-4 text-amber-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            {t(`upsell.${reason}_title`)}
          </p>
          <p className="text-xs text-white/70 mt-0.5">
            {t(`upsell.${reason}_subtitle`)}
          </p>

          {/* CTA Button */}
          <button
            onClick={handlePurchase}
            className={cn(
              "mt-2.5 px-4 py-1.5 text-xs font-medium rounded-full",
              "bg-gradient-to-r from-amber-500 to-yellow-500 text-black",
              "hover:from-amber-400 hover:to-yellow-400",
              "transition-all duration-200",
              "flex items-center gap-1.5",
              "focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2"
            )}
          >
            {t("upsell.try_voice")} - €1.99
          </button>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          aria-label={t("common.close")}
          className="flex-shrink-0 p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
