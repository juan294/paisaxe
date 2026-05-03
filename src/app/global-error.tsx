"use client";

import { useEffect, useMemo } from "react";
import * as Sentry from "@sentry/nextjs";
import { resolveLocale } from "@/lib/i18n/detect-language";
import { resolveTranslation } from "@/lib/i18n/resolve";
import { es } from "@/lib/i18n/es";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import { de } from "@/lib/i18n/de";
import { pt } from "@/lib/i18n/pt";
import { ast } from "@/lib/i18n/ast";
import type { Locale } from "@/lib/i18n/types";
import type { Translations } from "@/lib/i18n/types";

const locales: Record<Locale, Translations> = { es, en, fr, de, pt, ast };

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  const locale = useMemo(() => resolveLocale(), []);
  const t = (key: string) => resolveTranslation(key, locales[locale]);

  return (
    <html lang={locale}>
      <body style={{ margin: 0 }}>
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-center">
          <h1 className="text-2xl font-bold text-white">{t("errors.generic_title")}</h1>
          <p className="mt-4 max-w-md text-white/70">
            {t("errors.generic_description")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <button
              onClick={reset}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full px-6 py-3 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("errors.retry")}
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces the root layout, so next/link is unavailable */}
            <a
              href="/"
              className="text-white/60 hover:text-white transition-colors text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("errors.go_home")}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
