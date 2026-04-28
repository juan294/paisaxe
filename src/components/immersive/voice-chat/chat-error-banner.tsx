"use client";

import { useTranslation } from "@/lib/i18n";

interface ChatErrorBannerProps {
  error: string;
  isLoading: boolean;
  onRetry: () => void;
}

/**
 * ChatErrorBanner — displayed when the chat API returns an error.
 *
 * Shows an accessible alert with the error message and a retry button.
 */
export function ChatErrorBanner({ error, isLoading, onRetry }: ChatErrorBannerProps) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-lg bg-red-500/10 px-4 py-3 border border-red-500/20"
    >
      <p className="text-sm text-red-200">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isLoading}
        className="shrink-0 text-xs font-medium text-red-300 hover:text-red-100 underline disabled:opacity-50"
      >
        {t("chat.retry")}
      </button>
    </div>
  );
}
