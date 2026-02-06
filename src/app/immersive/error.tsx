"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function ImmersiveError({
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
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black px-4 text-center">
      <h1 className="text-2xl font-bold text-white">
        {t("errors.immersive_title")}
      </h1>
      <p className="mt-4 max-w-md text-white/70">
        {t("errors.immersive_description")}
      </p>
      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          onClick={reset}
          className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full px-6 py-3 text-white transition-colors"
        >
          {t("errors.retry")}
        </button>
        <Link
          href="/"
          className="text-white/60 hover:text-white transition-colors text-sm underline underline-offset-4"
        >
          {t("errors.go_home")}
        </Link>
      </div>
    </div>
  );
}
