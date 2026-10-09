"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function SiteFooter({ variant = "fixed" }: { variant?: "fixed" | "flow" }) {
  const { t } = useTranslation();

  return (
    <footer className={variant === "flow" ? "bg-neutral-950 py-4" : "fixed bottom-0 left-0 right-0 z-30 pointer-events-none"}>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs text-white/60">
        <span>{t("footer.content_attribution")}</span>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <span>{t("footer.ai_disclaimer")}</span>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 pointer-events-auto">
          <Link
            href="/terms"
            className="max-w-full rounded-sm underline underline-offset-2 hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            {t("footer.terms")}
          </Link>
          <Link
            href="/privacy"
            className="max-w-full rounded-sm underline underline-offset-2 hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
