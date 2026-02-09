"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-[10px] text-white/40">
        <span>{t("footer.content_attribution")}</span>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <span>{t("footer.ai_disclaimer")}</span>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <div className="flex items-center gap-2 pointer-events-auto">
          <Link
            href="/terms"
            className="underline underline-offset-2 hover:text-white/60 transition-colors"
          >
            {t("footer.terms")}
          </Link>
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-white/60 transition-colors"
          >
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
