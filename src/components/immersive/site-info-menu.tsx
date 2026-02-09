"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Eye, Bookmark, LogOut, LogIn, Info } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";

export function SiteInfoMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const { user, signInWithGoogle, signOut } = useAuth();

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, close]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={toggle}
        aria-label="Info"
        className="fixed bottom-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all duration-200 shadow-lg"
      >
        <Eye className="h-4 w-4" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          data-testid="info-menu-backdrop"
          className="fixed inset-0 z-30"
          onClick={close}
        />
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-16 left-4 z-30 w-72 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* User section */}
          <div className="px-4 py-3 border-b border-white/10">
            {user ? (
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name || "Avatar"}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
                    {(user.name || user.email || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {user.name || t("auth.user")}
                  </p>
                  {user.email && (
                    <p className="truncate text-xs text-white/50">{user.email}</p>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => signInWithGoogle()}
                className="flex w-full items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
              >
                <LogIn className="h-4 w-4" />
                {t("auth.sign_in")}
              </button>
            )}
          </div>

          {/* Navigation links */}
          <div className="px-2 py-1.5 border-b border-white/10">
            <Link
              href="/about"
              onClick={close}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Info className="h-4 w-4" />
              {t("info_menu.about")}
            </Link>
            <Link
              href="/favorites"
              onClick={close}
              aria-label={t("info_menu.saved_places")}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Bookmark className="h-4 w-4" />
              {t("info_menu.saved_places")}
            </Link>
          </div>

          {/* Legal & attribution */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-[10px] leading-relaxed text-white/40">
              {t("footer.content_attribution")}
            </p>
            <p className="text-[10px] leading-relaxed text-white/40">
              {t("footer.ai_disclaimer")}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Link
                href="/terms"
                onClick={close}
                className="text-[10px] text-white/40 underline underline-offset-2 hover:text-white/60 transition-colors"
              >
                {t("footer.terms")}
              </Link>
              <span className="text-white/20" aria-hidden="true">·</span>
              <Link
                href="/privacy"
                onClick={close}
                className="text-[10px] text-white/40 underline underline-offset-2 hover:text-white/60 transition-colors"
              >
                {t("footer.privacy")}
              </Link>
            </div>
          </div>

          {/* Sign out (only when signed in) */}
          {user && (
            <div className="border-t border-white/10 px-2 py-1.5">
              <button
                onClick={() => {
                  signOut();
                  close();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t("auth.sign_out")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
