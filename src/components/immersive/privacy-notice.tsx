"use client";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface PrivacyNoticeProps {
  onDismiss: () => void;
}

export function PrivacyNotice({ onDismiss }: PrivacyNoticeProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-4 mt-2 mb-1 p-3 rounded-2xl bg-white/10 border border-white/20 text-white/80 text-xs leading-relaxed">
      <p>
        {t("chat.privacy_notice")}
      </p>
      <div className="mt-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="text-white/70 hover:text-white hover:bg-white/10 text-xs h-7 px-3"
        >
          {t("chat.understood")}
        </Button>
      </div>
    </div>
  );
}
