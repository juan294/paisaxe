"use client";

import { cn } from "@/lib/utils";
import { X, AudioLines, Keyboard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface ChatHeaderProps {
  title: string;
  subtitle: string;
  /** Whether voice (ElevenLabs) mode is currently active */
  useElevenLabs: boolean;
  /** Whether access check is still in flight */
  isInitializing: boolean;
  /** True when the user has unlocked voice */
  canUseVoice: boolean;
  /** ElevenLabs agent id — undefined if not configured */
  agentId: string | null | undefined;
  /** Story slug for the upgrade redirect URL */
  storySlug?: string;
  /** Toggle between voice and text mode */
  onToggleMode: () => void;
  /** Close the chat dialog */
  onClose: () => void;
  /** Label of the switch to voice; the booking chat calls it "Voz (descubrimiento)". */
  tryVoiceLabel?: string;
}

/**
 * ChatHeader — the top bar of the VoiceChat dialog.
 *
 * Renders:
 * - Story title + subtitle
 * - Voice ↔ text mode toggle (when canUseVoice + agentId available)
 * - Upgrade link (when user cannot use voice)
 * - Close button
 */
export function ChatHeader({
  title,
  subtitle,
  useElevenLabs,
  isInitializing,
  canUseVoice,
  agentId,
  storySlug,
  onToggleMode,
  onClose,
  tryVoiceLabel,
}: ChatHeaderProps) {
  const { t } = useTranslation();
  const tryVoice = tryVoiceLabel ?? t("voice.try_voice");

  return (
    <div className="flex items-center justify-between p-4 border-b border-white/10">
      <div className="flex-1">
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/60">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {/* Voice mode toggle — only shown when user has access and agent is configured */}
        {!isInitializing && canUseVoice && agentId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMode}
            aria-label={useElevenLabs ? t("voice.use_text") : tryVoice}
            className={cn(
              "text-white hover:bg-white/10 text-xs gap-1.5",
              useElevenLabs && "bg-white/20"
            )}
          >
            {useElevenLabs ? (
              <Keyboard className="h-3.5 w-3.5" />
            ) : (
              <AudioLines className="h-3.5 w-3.5" />
            )}
            {useElevenLabs ? t("voice.use_text") : tryVoice}
          </Button>
        )}
        {/* Upgrade prompt — shown when user has no voice access */}
        {!isInitializing && !canUseVoice && (
          <Link
            href={storySlug ? `/pricing?returnTo=${storySlug}` : "/pricing"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-400 border border-green-500/50 rounded-full hover:bg-green-500/10 hover:border-green-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/70"
          >
            <AudioLines className="h-3.5 w-3.5" />
            <span>{t("voice.upgrade_cta")}</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t("accessibility.close_chat")}
          className="text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
