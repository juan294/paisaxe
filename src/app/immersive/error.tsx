"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { useTranslation } from "@/lib/i18n";
import {
  GLASS_RETRY_BUTTON_CLASS,
  GLASS_HOME_LINK_CLASS,
} from "@/lib/error-boundary-styles";

export default function ImmersiveError({
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
      className="fixed inset-0 flex flex-col items-center justify-center bg-neutral-950 px-4 text-center"
    >
      <h1 className="text-2xl font-bold text-white">
        {t("errors.immersive_title")}
      </h1>
      <p className="mt-4 max-w-md text-white/70">
        {t("errors.immersive_description")}
      </p>
      <div className="mt-8 flex flex-col items-center gap-4">
        <button onClick={reset} className={GLASS_RETRY_BUTTON_CLASS}>
          {t("errors.retry")}
        </button>
        <Link href="/" className={GLASS_HOME_LINK_CLASS}>
          {t("errors.go_home")}
        </Link>
      </div>
    </div>
  );
}
