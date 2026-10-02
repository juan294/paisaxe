"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut, LogIn, Info } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";

export function SiteInfoMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  // UX-M3 (#896): standardized on ToolbarOverflowMenu's focus-management
  // pattern (the most complete of the three toolbar dropdowns) — Escape
  // closes the menu and returns focus to the trigger.
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, close]);

  // Focus the first menu item when the panel opens.
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]');
      firstItem?.focus();
    }
  }, [isOpen]);

  // Arrow key navigation between menu items, matching ToolbarOverflowMenu.
  const handleMenuKeyDown = useCallback((event: React.KeyboardEvent) => {
    const menu = menuRef.current;
    if (!menu) return;

    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[next].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prev].focus();
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev].focus();
      } else {
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next].focus();
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
    );
  }

  return (
    <div className="relative">
      {/* Trigger: profile picture (signed in) or sign-in icon (signed out) */}
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={user ? (user.name || t("auth.user")) : t("auth.sign_in")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/50 flex items-center justify-center"
      >
        {user ? (
          user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name || "Avatar"}
              width={40}
              height={40}
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
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-12 z-50 w-72 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* User section */}
          <div className="px-4 py-3 border-b border-white/10">
            {user ? (
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name || "Avatar"}
                    width={32}
                    height={32}
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
                role="menuitem"
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
              role="menuitem"
              onClick={close}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Info className="h-4 w-4" />
              {t("info_menu.about")}
            </Link>
          </div>

          {/* Legal & attribution */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-[10px] leading-relaxed text-white/60">
              {t("footer.content_attribution")}
            </p>
            <p className="text-[10px] leading-relaxed text-white/60">
              {t("footer.ai_disclaimer")}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Link
                href="/terms"
                role="menuitem"
                onClick={close}
                className="text-[10px] text-white/60 underline underline-offset-2 hover:text-white/80 transition-colors"
              >
                {t("footer.terms")}
              </Link>
              <span className="text-white/20" aria-hidden="true">·</span>
              <Link
                href="/privacy"
                role="menuitem"
                onClick={close}
                className="text-[10px] text-white/60 underline underline-offset-2 hover:text-white/80 transition-colors"
              >
                {t("footer.privacy")}
              </Link>
            </div>
          </div>

          {/* Sign out (only when signed in) */}
          {user && (
            <div className="border-t border-white/10 px-2 py-1.5">
              <button
                role="menuitem"
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
