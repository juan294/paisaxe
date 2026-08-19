"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

// UX-M2: Changed from localStorage ("never show again") to sessionStorage ("once per
// browser session"). Returning visitors who open a new tab or browser session will
// see the swipe hint again, keeping the invisible tap zones discoverable without
// being intrusive to users who already know the gesture in the current session.
const STORAGE_KEY = "paisaxe-nav-hint-seen";
const AUTO_DISMISS_MS = 3000;
const FADE_OUT_MS = 500;

export function NavigationHint() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const { t } = useTranslation();

  const dismiss = useCallback(() => {
    setFading(true);
    // Mark as seen for this session only (sessionStorage clears on tab/browser close)
    sessionStorage.setItem(STORAGE_KEY, "true");
    setTimeout(() => setVisible(false), FADE_OUT_MS);
  }, []);

  useEffect(() => {
    // Only show on touch devices with phone-sized viewports (below sm breakpoint).
    // Tablets have pointer: coarse but wider screens where the permanent nav
    // arrows are already visible, so the swipe hint is unnecessary.
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    // Only show if not seen this session
    if (sessionStorage.getItem(STORAGE_KEY) === "true") return;

    setVisible(true);

    const timer = setTimeout(() => dismiss(), AUTO_DISMISS_MS);

    // UX-M9: The overlay is pointer-events-none (see className below), so it
    // never intercepts the tap that would otherwise reach the nav
    // zones/toolbar beneath it. Instead, dismiss on the user's *first*
    // interaction anywhere on the page via passive window listeners.
    // Passive means we never call preventDefault/stopPropagation, so the
    // same tap still performs whatever navigation it was meant to.
    const handleInteraction = () => {
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("click", handleInteraction);
      dismiss();
    };
    window.addEventListener("touchstart", handleInteraction, {
      passive: true,
    });
    window.addEventListener("click", handleInteraction, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("click", handleInteraction);
    };
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-between px-8 pointer-events-none transition-opacity duration-500",
        fading ? "opacity-0" : "opacity-100"
      )}
      data-testid="navigation-hint"
    >
      {/* Left hint */}
      <div className="flex flex-col items-center gap-2 animate-pulse">
        <div className="rounded-full bg-white/20 backdrop-blur-sm p-3">
          <ChevronLeft className="h-8 w-8 text-white/80" />
        </div>
        <span className="text-white/70 text-xs font-medium">
          {t("nav.hint_previous")}
        </span>
      </div>

      {/* Right hint */}
      <div className="flex flex-col items-center gap-2 animate-pulse">
        <div className="rounded-full bg-white/20 backdrop-blur-sm p-3">
          <ChevronRight className="h-8 w-8 text-white/80" />
        </div>
        <span className="text-white/70 text-xs font-medium">
          {t("nav.hint_next")}
        </span>
      </div>
    </div>
  );
}
