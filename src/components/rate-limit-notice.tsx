"use client";

import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";

export function RateLimitNotice({ retryAfter, onRetry }: { retryAfter?: number | null; onRetry: () => void }) {
  const { t } = useTranslation();
  if (retryAfter == null) return null;
  return (
    <div role="alert" className="relative z-50 rounded-lg bg-neutral-950 p-3 text-sm text-white">
      <p>{interpolate(t("common.rateLimited"), {seconds: retryAfter})}</p>
      <button type="button" onClick={onRetry} className="mt-2 rounded px-3 py-2 underline focus-visible:outline focus-visible:outline-2">{t("common.retry")}</button>
    </div>
  );
}
