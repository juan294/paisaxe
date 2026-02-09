"use client";

import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

export default function FavoritesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-center">
      <h1 className="text-2xl font-bold text-white">
        {t("errors.favorites_title")}
      </h1>
      <p className="mt-4 max-w-md text-white/70">
        {t("errors.favorites_description")}
      </p>
      <button
        onClick={reset}
        className="mt-8 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full px-6 py-3 text-white transition-colors"
      >
        {t("errors.retry")}
      </button>
    </div>
  );
}
