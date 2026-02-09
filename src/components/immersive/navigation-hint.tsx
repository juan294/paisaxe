"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const STORAGE_KEY = "paisaxe-nav-hint-seen";
const AUTO_DISMISS_MS = 3000;
const FADE_OUT_MS = 500;

export function NavigationHint() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const { t } = useTranslation();

  const dismiss = useCallback(() => {
    setFading(true);
    localStorage.setItem(STORAGE_KEY, "true");
    setTimeout(() => setVisible(false), FADE_OUT_MS);
  }, []);

  useEffect(() => {
    // Only show on touch devices with phone-sized viewports (below sm breakpoint).
    // Tablets have pointer: coarse but wider screens where the permanent nav
    // arrows are already visible, so the swipe hint is unnecessary.
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    // Only show if not seen before
    if (localStorage.getItem(STORAGE_KEY) === "true") return;

    setVisible(true);

    const timer = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-between px-8 transition-opacity duration-500",
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
      onClick={dismiss}
      onTouchStart={dismiss}
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
