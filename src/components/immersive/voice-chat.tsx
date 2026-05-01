"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Story } from "@/types/immersive";
import { PrivacyNotice } from "./privacy-notice";
import { ChatActions } from "./chat-actions";
import { useTranslation } from "@/lib/i18n";
import { getLocalizedStory } from "@/lib/localize-story";
import { useVoiceAccess } from "@/hooks/use-voice-access";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { useChatMode } from "@/hooks/use-chat-mode";
import dynamic from "next/dynamic";
import { VoicePurchaseCTA } from "@/components/premium/voice-purchase-cta";
import { usePostHog } from "posthog-js/react";

import { ChatHeader } from "./voice-chat/chat-header";
import { ChatMessageList } from "./voice-chat/chat-message-list";
import { ChatComposer } from "./voice-chat/chat-composer";
import { ChatErrorBanner } from "./voice-chat/chat-error-banner";

/**
 * Loading skeleton shown while the VoiceChatElevenLabs chunk is being fetched.
 * Defined as a proper React component so it can use the useTranslation hook
 * for i18n — the loading text is localised via voice.loading.
 */
function VoiceLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div
      data-testid="voice-loading-fallback"
      role="status"
      aria-label={t("voice.loading")}
      className="h-64 md:h-96 lg:h-[28rem] flex items-center justify-center"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-20 w-20 rounded-full bg-white/10 animate-pulse" />
        <div className="animate-pulse text-white/50 text-sm">
          {t("voice.loading")}
        </div>
      </div>
    </div>
  );
}

// Dynamically import VoiceChatElevenLabs to defer the ~471KB LiveKit/ElevenLabs chunk.
// This code only loads when voice mode is active (user has access + agent configured).
const VoiceChatElevenLabs = dynamic(
  () => import("./voice-chat-elevenlabs").then((mod) => mod.VoiceChatElevenLabs),
  {
    ssr: false,
    loading: () => <VoiceLoadingFallback />,
  }
);

interface VoiceChatProps {
  story: Story;
  open: boolean;
  onClose: () => void;
  initialMessage?: string;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function VoiceChat({ story, open, onClose, initialMessage, triggerRef }: VoiceChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useTranslation();
  const localizedStory = getLocalizedStory(story, locale);
  const posthog = usePostHog();
  const stableOnClose = useMemo(() => onClose, [onClose]);
  useFocusTrap(dialogRef, open, stableOnClose);

  const handleClose = useCallback(() => {
    triggerRef?.current?.focus();
    onClose();
  }, [onClose, triggerRef]);

  // Check for voice access (whitelisted OR paid)
  const {
    canUseVoice,
    needsPurchase,
    agentId,
    expiresAt,
    hoursUntilExpiry,
    isLoading: isVoiceAccessLoading
  } = useVoiceAccess();

  // Stream chat hook for SSE message handling
  const {
    messages,
    isStreaming: isLoading,
    error: chatError,
    sendMessage,
    resetMessages,
    dismissUpsell: handleUpsellDismiss,
  } = useStreamChat({ canUseVoice });

  // Voice/text mode state — extracted to useChatMode hook
  const { useElevenLabs, setUseElevenLabs, toggle: handleToggleMode } = useChatMode(false);

  // Sync voice mode whenever access status resolves or changes (e.g., mid-session purchase)
  useEffect(() => {
    if (!isVoiceAccessLoading && canUseVoice && agentId) {
      setUseElevenLabs(true);
    }
  }, [isVoiceAccessLoading, canUseVoice, agentId, setUseElevenLabs]);

  // Don't render content until we've determined the default mode
  const isInitializing = isVoiceAccessLoading;

  // Reset messages when story changes
  useEffect(() => {
    resetMessages();
  }, [story.id, resetMessages]);

  // Check if privacy notice was already acknowledged
  useEffect(() => {
    const acknowledged = localStorage.getItem("paisaxe-privacy-acknowledged");
    if (acknowledged === "true") {
      setPrivacyAcknowledged(true);
    }
  }, []);

  // Auto-send initial message — one-shot on mount.
  // Capture prop in a ref so the effect never re-runs when the prop changes later.
  // messages.length and isLoading are always 0/false at mount, so not needed in deps.
  const initialMessageRef = useRef(initialMessage);
  useEffect(() => {
    if (initialMessageRef.current) {
      setInputValue(initialMessageRef.current);
    }
    // Intentionally empty — one-shot on mount. (#330: replaced eslint-disable with ref guard)

  }, []);

  const handlePrivacyDismiss = useCallback(() => {
    setPrivacyAcknowledged(true);
    localStorage.setItem("paisaxe-privacy-acknowledged", "true");
  }, []);

  const handleVoiceFallback = useCallback(() => {
    setUseElevenLabs(false);
  }, [setUseElevenLabs]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    const isFirstMessage = messages.length === 0;
    setInputValue("");
    setLastMessage(userMessage);

    // Track chat events in PostHog
    if (isFirstMessage) {
      posthog?.capture("chat_conversation_started", { story_id: story.id });
    }
    posthog?.capture("chat_message_sent", {
      story_id: story.id,
      message_index: messages.filter((m) => m.role === "user").length,
    });

    await sendMessage(userMessage, {
      context: `The user is viewing: ${localizedStory.title} (${localizedStory.subtitle}). ${localizedStory.description}. Source: ${story.sourcePdf}.`,
      locale,
      messageIndex: messages.filter((m) => m.role === "user").length,
    });
  };

  const handleRetry = useCallback(async () => {
    if (!lastMessage || isLoading) return;
    await sendMessage(lastMessage, {
      context: `The user is viewing: ${localizedStory.title} (${localizedStory.subtitle}). ${localizedStory.description}. Source: ${story.sourcePdf}.`,
      locale,
      messageIndex: messages.filter((m) => m.role === "user").length,
    });
  }, [lastMessage, isLoading, sendMessage, localizedStory, story, locale, messages]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("accessibility.chat_dialog").replace("{title}", localizedStory.title)}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Chat panel */}
      <div className="relative z-10 w-full max-w-lg bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none">
        <ChatHeader
          title={localizedStory.title}
          subtitle={localizedStory.subtitle}
          useElevenLabs={useElevenLabs}
          isInitializing={isInitializing}
          canUseVoice={canUseVoice}
          agentId={agentId}
          storySlug={story.slug}
          onToggleMode={handleToggleMode}
          onClose={handleClose}
        />

        {/* Privacy Notice */}
        {!privacyAcknowledged && (
          <PrivacyNotice onDismiss={handlePrivacyDismiss} />
        )}

        {/* Expiry warning for users with < 6 hours remaining */}
        {canUseVoice && hoursUntilExpiry !== null && hoursUntilExpiry < 6 && expiresAt && (
          <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg bg-amber-500/10 p-3 border border-amber-500/20">
            <p className="text-xs text-amber-200">
              {t("premium.voice_pass_expiry")
                .replace("{hours}", String(Math.ceil(hoursUntilExpiry)))
                .replace("{time}", expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
            </p>
          </div>
        )}

        {/* ElevenLabs Voice Chat or Text Chat */}
        {isInitializing ? (
          /* Show loading while determining voice access */
          <div className="h-64 md:h-96 lg:h-[28rem] flex items-center justify-center">
            <div className="animate-pulse text-white/50 text-sm">
              {t("common.loading")}
            </div>
          </div>
        ) : useElevenLabs && canUseVoice && agentId ? (
          <VoiceChatElevenLabs
            story={story}
            agentId={agentId}
            onFallbackToText={handleVoiceFallback}
          />
        ) : useElevenLabs && needsPurchase ? (
          /* Show purchase CTA when user wants voice but needs to pay */
          <VoicePurchaseCTA returnTo={story.slug} />
        ) : (
          <>
            <ChatMessageList
              messages={messages}
              isLoading={isLoading}
              onUpsellDismiss={handleUpsellDismiss}
            />

            {/* Error banner for chat API failures */}
            {chatError && (
              <ChatErrorBanner
                error={chatError}
                isLoading={isLoading}
                onRetry={handleRetry}
              />
            )}

            {/* Context-aware action buttons */}
            <ChatActions messages={messages} isLoading={isLoading} />

            <ChatComposer
              value={inputValue}
              isLoading={isLoading}
              onChange={setInputValue}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </div>
    </div>
  );
}
