"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";

interface ChatComposerProps {
  value: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
}

/**
 * ChatComposer — the text input form at the bottom of VoiceChat.
 *
 * Renders a single-line input and a send button. The submit button is
 * disabled while a response is streaming or the input is empty.
 */
export function ChatComposer({ value, isLoading, onChange, onSubmit }: ChatComposerProps) {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={onSubmit}
      className="p-4 border-t border-white/10 flex gap-2 items-center"
    >
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("chat.placeholder")}
        aria-label={t("chat.placeholder")}
        disabled={isLoading}
        className="flex-1 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
      />
      <Button
        type="submit"
        disabled={isLoading || !value.trim()}
        aria-label={t("accessibility.send_message")}
        className="h-10 w-10 bg-white text-gray-900 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
