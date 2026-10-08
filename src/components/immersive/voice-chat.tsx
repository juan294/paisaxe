"use client";

import { RateLimitNotice } from "@/components/rate-limit-notice";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Story } from "@/types/immersive";
import { PrivacyNotice } from "./privacy-notice";
import { ChatActions } from "./chat-actions";
import { useTranslation } from "@/lib/i18n";
import { getLocalizedStory } from "@/lib/localize-story";
import { useVoiceAccess } from "@/hooks/use-voice-access";
import { useAuth } from "@/hooks/use-auth";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useStreamChat, type StreamChatMessage } from "@/hooks/use-stream-chat";
import { useBookingAccess } from "@/hooks/use-booking-access";
import { useBookingChat } from "@/hooks/use-booking-chat";
import { useChatMode } from "@/hooks/use-chat-mode";
import dynamic from "next/dynamic";
import { VoicePurchaseCTA } from "@/components/premium/voice-purchase-cta";
import { usePaisaxePostHog } from "@/components/posthog-provider";
import { toIntlLocale } from "@/lib/utils";

import { ChatHeader } from "./voice-chat/chat-header";
import { ChatMessageList } from "./voice-chat/chat-message-list";
import { ChatComposer } from "./voice-chat/chat-composer";
import { ChatErrorBanner } from "./voice-chat/chat-error-banner";
import { BookingCards } from "./voice-chat/booking-cards";

// FE-M1: the streaming hot path pushes a `messages` state update on every SSE
// token, re-rendering VoiceChat every token. ChatComposer and ChatActions
// don't need to re-render on every token (the composer's props are static
// while streaming; ChatActions renders null while `isLoading`), so memoize
// them here so React can bail out when their props are referentially
// unchanged. This only pays off once VoiceChat itself stops handing them new
// callback identities every render — see handleSubmit/submitMessage/
// handleRetry below, which now read the live message count via `messagesRef`
// instead of depending on `messages` directly.
const MemoizedChatComposer = memo(ChatComposer);
const MemoizedChatActions = memo(ChatActions);

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
  /** Opened from the voucher entry (?booking=1): stay in the text booking chat (F06). */
  bookingMode?: boolean;
}

export function VoiceChat({ story, open, onClose, initialMessage, triggerRef, bookingMode = false }: VoiceChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useTranslation();
  // FE-M1: getLocalizedStory returns a brand-new object every call. Without
  // memoizing on [story, locale], `localizedStory` got a new identity on
  // every render (including every streamed token) and fed straight into
  // buildStoryContext's deps below, recreating it — and therefore
  // submitMessage/handleSubmit/handleRetry — every token too, which defeated
  // the ChatComposer memoization this fix depends on.
  const localizedStory = useMemo(
    () => getLocalizedStory(story, locale),
    [story, locale]
  );
  const posthog = usePaisaxePostHog();
  // FE-H4: forward the signed-in user's session token so voice-mode MCP tool
  // calls (bookings, favorites) can authenticate.
  const { session } = useAuth();
  // FE-H3: useFocusTrap holds onEscape in a ref internally, so passing
  // onClose directly (rather than through a no-op stabilizing memo) is
  // safe — the trap's install/teardown effect doesn't depend on it.
  useFocusTrap(dialogRef, open, onClose);

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
    isLoading: isVoiceAccessLoading,
    retryAfter, refresh
  } = useVoiceAccess();

  // Stream chat hooks for SSE message handling. A visitor with an active
  // voucher redemption gets the booking chat (tools, cards); everyone else the
  // discovery chat. Both hooks always run (rules of hooks); one is used.
  const discoveryChat = useStreamChat({ canUseVoice });
  const bookingChat = useBookingChat();
  const { active: bookingActive, isLoading: isBookingAccessLoading } = useBookingAccess();
  const chat = bookingActive ? bookingChat : discoveryChat;
  const {
    messages,
    isStreaming: isLoading,
    error: chatError,
    resetMessages,
    dismissUpsell: handleUpsellDismiss,
    // FE-M1: kept in sync by the chat hook itself (synchronously, inside the
    // same setState updater as every message mutation) — read this instead
    // of `messages` in submitMessage/handleRetry below so those callbacks'
    // identity doesn't change on every streamed token.
    messagesRef,
  } = chat;
  const discoverySend = discoveryChat.sendMessage;
  const bookingSend = bookingChat.sendMessage;
  const sendMessage = useCallback(
    (message: string, options: { context: string; locale: string; messageIndex: number }) =>
      bookingActive ? bookingSend(message, { locale: options.locale }) : discoverySend(message, options),
    [bookingActive, bookingSend, discoverySend]
  );

  // Voice/text mode state — extracted to useChatMode hook
  const { useElevenLabs, setUseElevenLabs, toggle: handleToggleMode } = useChatMode(false);

  // Whether voice mode is/will be the active mode once access resolves — a
  // single source shared by the mode-sync effect and the initial-message
  // effect below so the two can't independently drift out of sync.
  // Booking mode keeps the text chat even when the voucher's voice pass makes
  // voice available (F06); voice stays one toggle away.
  const willUseVoiceMode = canUseVoice && !!agentId && !bookingMode;

  // Sync voice mode whenever access status resolves or changes (e.g., mid-session purchase)
  useEffect(() => {
    if (!isVoiceAccessLoading && willUseVoiceMode) {
      setUseElevenLabs(true);
    }
  }, [isVoiceAccessLoading, willUseVoiceMode, setUseElevenLabs]);

  // Don't render content until we've determined the default mode, and which
  // chat a turn goes to: a turn sent before booking access resolved would go
  // to the discovery chat and then vanish when the booking chat takes over.
  const isInitializing = isVoiceAccessLoading || isBookingAccessLoading;

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

  // Story context passed to the chat API — shared by every message-sending
  // path (submit, retry, initial-message auto-send) so it can't drift.
  const buildStoryContext = useCallback(
    () =>
      `The user is viewing: ${localizedStory.title} (${localizedStory.subtitle}). ${localizedStory.description}. Source: ${story.sourcePdf}.`,
    [localizedStory, story]
  );

  // Sends a user message and tracks it in PostHog — shared by the composer's
  // Send button and the initial-message auto-send effect below (UX-H1) so
  // tracking/context logic lives in one place instead of being copy-pasted.
  const submitMessage = useCallback(
    async (message: string) => {
      // FE-M1: read via messagesRef (not `messages`) so this callback's
      // identity — and therefore handleSubmit's, and therefore
      // ChatComposer's memoized props — stays stable while messages grows
      // on every streamed token.
      const currentMessages = messagesRef.current;
      const isFirstMessage = currentMessages.length === 0;
      const messageIndex = currentMessages.filter((m) => m.role === "user").length;
      setLastMessage(message);
      if (isFirstMessage) {
        posthog?.capture("chat_conversation_started", { story_id: story.id });
      }
      posthog?.capture("chat_message_sent", { story_id: story.id, message_index: messageIndex });
      await sendMessage(message, { context: buildStoryContext(), locale, messageIndex });
    },
    // messagesRef is a stable ref object (its identity never changes across
    // renders), so including it doesn't affect how often this is recreated.
    [posthog, story, sendMessage, buildStoryContext, locale, messagesRef]
  );

  // Auto-send initial message (e.g. a suggested-question chip) — one-shot,
  // deferred until voice-access resolution settles so we know which mode will
  // actually render:
  //  - Voice mode: VoiceChatElevenLabs reads initialMessageRef.current directly
  //    and forwards it as the `opening_question` dynamic variable (FE-H4/UX-H7),
  //    so the ref is left untouched for it to read.
  //  - Text mode: auto-submit here so a chip tap produces an answer instead of
  //    silently prefilling `inputValue` and waiting for a second tap on Send
  //    that ChatComposer (unmounted in voice mode) may never offer (UX-H1).
  // Capture prop in a ref so the effect never re-runs when the prop changes
  // later; clearing it after consuming doubles as the one-shot "handled" guard.
  const initialMessageRef = useRef(initialMessage);
  useEffect(() => {
    if (!initialMessageRef.current || isInitializing || willUseVoiceMode) {
      return;
    }
    const message = initialMessageRef.current;
    initialMessageRef.current = undefined;
    void submitMessage(message);
  }, [isInitializing, willUseVoiceMode, submitMessage]);

  const handlePrivacyDismiss = useCallback(() => {
    setPrivacyAcknowledged(true);
    localStorage.setItem("paisaxe-privacy-acknowledged", "true");
  }, []);

  const handleVoiceFallback = useCallback(() => {
    setUseElevenLabs(false);
  }, [setUseElevenLabs]);

  // FE-M1: memoized so ChatComposer (wrapped in memo below) can bail out of
  // re-rendering on every streamed token — its identity now only changes
  // when inputValue/isLoading actually change (i.e. when the user types or a
  // send starts/stops), not on every setMessages call from the SSE stream.
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!inputValue.trim() || isLoading) return;

      const userMessage = inputValue.trim();
      setInputValue("");
      await submitMessage(userMessage);
    },
    [inputValue, isLoading, submitMessage]
  );

  const handleRetry = useCallback(async () => {
    if (!lastMessage || isLoading) return;
    await sendMessage(lastMessage, {
      context: buildStoryContext(),
      locale,
      messageIndex: messagesRef.current.filter((m) => m.role === "user").length,
    });
  }, [lastMessage, isLoading, sendMessage, buildStoryContext, locale, messagesRef]);

  const { acceptQuote, quoteStates } = bookingChat;
  const handleRequote = useCallback(() => {
    void submitMessage(t("booking.chat.requoteMessage"));
  }, [submitMessage, t]);
  const renderCards = useCallback(
    (msg: StreamChatMessage) =>
      msg.cards ? (
        <BookingCards
          cards={msg.cards}
          quoteStates={quoteStates}
          onAccept={(quoteId) => void acceptQuote(quoteId, locale)}
          onRequote={handleRequote}
          busy={isLoading}
        />
      ) : null,
    [acceptQuote, quoteStates, locale, handleRequote, isLoading]
  );

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
          tryVoiceLabel={bookingActive ? t("booking.chat.voiceDiscovery") : undefined}
        />

        <RateLimitNotice retryAfter={retryAfter} onRetry={() => { void refresh(); }} />

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
                .replace("{time}", expiresAt.toLocaleTimeString(toIntlLocale(locale), { hour: '2-digit', minute: '2-digit' }))}
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
            userAccessToken={session?.access_token}
            initialMessage={initialMessageRef.current}
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
              renderCards={bookingActive ? renderCards : undefined}
            />

            {/* Kept mounted so screen readers announce the line when it appears. */}
            {bookingActive && (
              <p role="status" className={bookingChat.statusLine ? "px-4 pb-2 text-xs text-white/70" : "sr-only"}>
                {bookingChat.statusLine ?? ""}
              </p>
            )}

            {/* Error banner for chat API failures */}
            {chatError && (
              <ChatErrorBanner
                error={chatError}
                isLoading={isLoading}
                onRetry={handleRetry}
              />
            )}

            {/* Context-aware action buttons */}
            <MemoizedChatActions messages={messages} isLoading={isLoading} />

            <MemoizedChatComposer
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
