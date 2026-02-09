"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bookmark, LogOut, LogIn, Info } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";

export function SiteInfoMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();

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

  if (isLoading) {
    return (
      <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
    );
  }

  return (
    <div className="relative">
      {/* Trigger: profile picture (signed in) or sign-in icon (signed out) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={user ? (user.name || t("auth.user")) : t("auth.sign_in")}
        className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/50 flex items-center justify-center"
      >
        {user ? (
          user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name || "Avatar"}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-white text-sm font-medium">
              {(user.name || user.email || "U")[0].toUpperCase()}
            </span>
          )
        ) : (
          <LogIn className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          data-testid="info-menu-backdrop"
          className="fixed inset-0 z-40"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
        />
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute right-0 top-12 z-50 w-72 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
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
                    referrerPolicy="no-referrer"
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
                aria-label={t("auth.sign_out")}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t("auth.sign_out")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
