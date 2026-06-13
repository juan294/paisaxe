"use client";

import { useEffect, useMemo } from "react";
import * as Sentry from "@sentry/nextjs";
import { resolveLocale } from "@/lib/i18n/detect-language";
import type { Locale } from "@/lib/i18n/types";

const errorCopy: Record<
  Locale,
  {
    title: string;
    description: string;
    retry: string;
    goHome: string;
  }
> = {
  es: {
    title: "Algo salió mal",
    description: "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.",
    retry: "Reintentar",
    goHome: "Volver al inicio",
  },
  en: {
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again.",
    retry: "Retry",
    goHome: "Back to home",
  },
  fr: {
    title: "Une erreur est survenue",
    description: "Une erreur inattendue est survenue. Veuillez réessayer.",
    retry: "Réessayer",
    goHome: "Retour à l'accueil",
  },
  de: {
    title: "Etwas ist schiefgelaufen",
    description: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
    retry: "Erneut versuchen",
    goHome: "Zurück zur Startseite",
  },
  pt: {
    title: "Algo correu mal",
    description: "Ocorreu um erro inesperado. Por favor, tente novamente.",
    retry: "Tentar novamente",
    goHome: "Voltar ao início",
  },
  ast: {
    title: "Algo salió mal",
    description: "Hebo un error inesperáu. Por favor, inténtalo otra vuelta.",
    retry: "Reintentar",
    goHome: "Tornar al aniciu",
  },
};

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
  const copy = errorCopy[locale] ?? errorCopy.es;

  return (
    <html lang={locale}>
      <body style={{ margin: 0 }}>
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-center">
          <h1 className="text-2xl font-bold text-white">{copy.title}</h1>
          <p className="mt-4 max-w-md text-white/70">
            {copy.description}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <button
              onClick={reset}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full px-6 py-3 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {copy.retry}
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces the root layout, so next/link is unavailable */}
            <a
              href="/"
              className="text-white/60 hover:text-white transition-colors text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {copy.goHome}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
