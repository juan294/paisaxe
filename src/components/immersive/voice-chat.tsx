"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Story } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { X, Send, AudioLines, Keyboard } from "lucide-react";
import Link from "next/link";
import { ChatMessageSkeleton } from "./skeleton-chat-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrivacyNotice } from "./privacy-notice";
import { ChatActions } from "./chat-actions";
import { ChatUpsellCTA } from "./chat-upsell-cta";
import { useTranslation } from "@/lib/i18n";
import { getLocalizedStory } from "@/lib/localize-story";
import { useVoiceAccess } from "@/hooks/use-voice-access";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { VoiceChatElevenLabs } from "./voice-chat-elevenlabs";
import { VoicePurchaseCTA } from "@/components/premium/voice-purchase-cta";
import { usePostHog } from "posthog-js/react";

interface VoiceChatProps {
  story: Story;
  open: boolean;
  onClose: () => void;
  initialMessage?: string;
}

export function VoiceChat({ story, open, onClose, initialMessage }: VoiceChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [useElevenLabs, setUseElevenLabs] = useState(false);
  const [hasSetDefaultMode, setHasSetDefaultMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useTranslation();
  const localizedStory = getLocalizedStory(story, locale);
  const posthog = usePostHog();
  const stableOnClose = useMemo(() => onClose, [onClose]);
  useFocusTrap(dialogRef, open, stableOnClose);

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
    sendMessage,
    resetMessages,
    dismissUpsell: handleUpsellDismiss,
  } = useStreamChat({ canUseVoice });

  // Set voice mode as default when user has access (only on first load)
  useEffect(() => {
    if (!isVoiceAccessLoading && !hasSetDefaultMode) {
      if (canUseVoice && agentId) {
        setUseElevenLabs(true);
      }
      setHasSetDefaultMode(true);
    }
  }, [isVoiceAccessLoading, canUseVoice, agentId, hasSetDefaultMode]);

  // Don't render content until we've determined the default mode
  const isInitializing = isVoiceAccessLoading || !hasSetDefaultMode;

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

  // Auto-send initial message
  useEffect(() => {
    if (initialMessage && messages.length === 0 && !isLoading) {
      setInputValue(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handlePrivacyDismiss = useCallback(() => {
    setPrivacyAcknowledged(true);
    localStorage.setItem("paisaxe-privacy-acknowledged", "true");
  }, []);

  const handleVoiceFallback = useCallback(() => {
    setUseElevenLabs(false);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    const isFirstMessage = messages.length === 0;
    setInputValue("");

    // Track chat events in PostHog
    if (isFirstMessage) {
      posthog?.capture("chat_conversation_started", { story_id: story.id });
    }
    posthog?.capture("chat_message_sent", {
      story_id: story.id,
      message_index: messages.length,
    });

    await sendMessage(userMessage, {
      context: `The user is viewing: ${localizedStory.title} (${localizedStory.subtitle}). ${localizedStory.description}. Source: ${story.sourcePdf}.`,
      locale,
      messageIndex: messages.filter((m) => m.role === "user").length,
    });
  };

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 md:items-center"
      role="dialog"
      aria-label={t("accessibility.chat_dialog").replace("{title}", localizedStory.title)}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Chat panel */}
      <div className="relative z-10 w-full max-w-lg bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none">
        {/* Header with voice mode toggle */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex-1">
            <h2 className="font-semibold text-white">{localizedStory.title}</h2>
            <p className="text-sm text-white/60">{localizedStory.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Voice mode toggle - only show when user can use voice and not initializing */}
            {!isInitializing && canUseVoice && agentId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseElevenLabs(!useElevenLabs)}
                aria-label={useElevenLabs ? t("voice.use_text") : t("voice.try_voice")}
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
                {useElevenLabs ? t("voice.use_text") : t("voice.try_voice")}
              </Button>
            )}
            {/* Upgrade prompt for users without voice access (signed in or not) */}
            {!isInitializing && !canUseVoice && (
              <Link
                href={story.slug ? `/pricing?returnTo=${story.slug}` : "/pricing"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-400 border border-green-500/50 rounded-full hover:bg-green-500/10 hover:border-green-400 transition-colors"
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
          <div className="h-64 flex items-center justify-center">
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
            {/* Messages */}
            <div
              role="log"
              aria-live="polite"
              aria-label={t("accessibility.chat_messages")}
              className="h-64 overflow-y-auto p-4 space-y-4"
            >
              {messages.length === 0 && (
                <div className="text-center text-white/50 py-8">
                  <p>{t("chat.empty_state")}</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i}>
                  <div
                    className={cn(
                      "max-w-[85%] p-3 rounded-2xl",
                      msg.role === "user"
                        ? "ml-auto bg-white text-gray-900"
                        : "bg-white/20 text-white"
                    )}
                  >
                    {msg.role === "user" ? (
                      msg.content
                    ) : (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li>{children}</li>,
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                    {msg.images && msg.images.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {msg.images.map((image) => (
                          <figure key={image.id} className="overflow-hidden rounded-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.path}
                              alt={image.caption || t("chat.image_alt")}
                              className="w-full rounded-xl object-cover"
                              loading="lazy"
                            />
                            {image.caption && (
                              <figcaption className="mt-1.5 text-xs text-white/70">
                                {image.caption}
                              </figcaption>
                            )}
                            <p className="mt-0.5 text-xs text-white/60">
                              {t("chat.source")}: {image.sourcePdf}
                            </p>
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Inline upsell CTA for messages with detected upsell triggers */}
                  {msg.upsellReason && !msg.upsellDismissed && (
                    <ChatUpsellCTA
                      reason={msg.upsellReason}
                      onDismiss={() => handleUpsellDismiss(i)}
                      className="mt-3"
                    />
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === "" && (
                <ChatMessageSkeleton />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Context-aware action buttons */}
            <ChatActions messages={messages} isLoading={isLoading} />

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="p-4 border-t border-white/10 flex gap-2 items-center"
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t("chat.placeholder")}
                aria-label={t("chat.placeholder")}
                disabled={isLoading}
                className="flex-1 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
              <Button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                aria-label={t("accessibility.send_message")}
                className="h-10 w-10 bg-white text-gray-900 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
