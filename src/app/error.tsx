"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/ui/logo";

export default function RootError({
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

  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-center"
    >
      <div className="mb-8 h-16 w-16 text-primary">
        <Logo />
      </div>
      <h1 className="text-2xl font-bold text-white">{t("errors.generic_title")}</h1>
      <p className="mt-4 max-w-md text-white/70">
        {t("errors.generic_description")}
      </p>
      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          onClick={reset}
          className="bg-primary hover:bg-primary/90 rounded-full px-6 py-3 text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          {t("errors.retry")}
        </button>
        <Link
          href="/"
          className="text-white/60 hover:text-white transition-colors text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {t("errors.go_home")}
        </Link>
      </div>
    </div>
  );
}
