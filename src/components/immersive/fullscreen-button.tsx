"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Maximize, X, Share } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { Button } from "@/components/ui/button";

export function FullscreenButton() {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const closeInstructions = useCallback(() => {
    setShowInstructions(false);
  }, []);

  useFocusTrap(modalRef, showInstructions, closeInstructions);

  useEffect(() => {
    // Detect iOS/iPadOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);

    // Check if running as standalone PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true;
    setIsStandalone(standalone);

    // Check fullscreen API support
    setSupportsFullscreen(!!document.documentElement.requestFullscreen);

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isIOS) {
      // Show instructions for iOS
      setShowInstructions(true);
    } else if (supportsFullscreen) {
      // Use Fullscreen API for desktop
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    }
  }, [isIOS, supportsFullscreen]);

  // Don't show button if already in standalone mode
  if (isStandalone) {
    return null;
  }

  // Don't show on desktop if fullscreen not supported
  if (!isIOS && !supportsFullscreen) {
    return null;
  }

  return (
    <>
      <Button
        variant="glassIcon"
        onClick={toggleFullscreen}
        aria-label={t("fullscreen.toggle")}
        title={t("fullscreen.toggle")}
      >
        <Maximize className={cn("h-5 w-5 text-white", isFullscreen && "hidden")} />
        <X className={cn("h-5 w-5 text-white", !isFullscreen && "hidden")} />
      </Button>

      {/* iOS Instructions Modal */}
      {showInstructions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closeInstructions}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            className="bg-neutral-900 rounded-2xl p-6 max-w-sm w-full text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t("fullscreen.install_title")}</h2>
              <button
                onClick={closeInstructions}
                className="p-1 rounded-full hover:bg-white/10"
                aria-label={t("common.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-white/70 mb-6 text-sm">
              {t("fullscreen.install_description")}
            </p>

            <ol className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">
                  1
                </span>
                <div className="flex items-center gap-2">
                  <span>{t("fullscreen.step_tap")}</span>
                  <Share className="h-4 w-4 text-blue-400" />
                  <span>{t("fullscreen.step_share")}</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">
                  2
                </span>
                <span>{t("fullscreen.step_add_home")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">
                  3
                </span>
                <span>{t("fullscreen.step_open")}</span>
              </li>
            </ol>

            <button
              onClick={closeInstructions}
              className="mt-6 w-full py-3 bg-white text-black rounded-full font-medium hover:bg-white/90 transition-colors"
            >
              {t("fullscreen.got_it")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
