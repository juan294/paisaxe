"use client";

import { useEffect } from "react";
import { loadSentryIfConfigured } from "@/lib/sentry-client-init";
import { useTranslation } from "@/lib/i18n";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    let active = true;
    void loadSentryIfConfigured()
      .then((Sentry) => {
        if (active) return Sentry?.captureException(error);
      })
      .catch(() => {
        // Reporting failure must not interrupt recovery or report recursively.
      });
    return () => { active = false; };
  }, [error]);

  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 text-center">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
        {t("errors.admin_title")}
      </h1>
      <p className="mt-4 max-w-md text-neutral-600 dark:text-neutral-400">
        {t("errors.admin_description")}
      </p>
      <button
        onClick={reset}
        className="mt-8 bg-neutral-900 hover:bg-neutral-800 dark:bg-white/20 dark:hover:bg-white/30 rounded-full px-6 py-3 text-white transition-colors"
      >
        {t("errors.retry")}
      </button>
    </div>
  );
}
