"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { csrfHeaders } from "@/lib/csrf-client";
import { useTranslation } from "@/lib/i18n";
import type { BookingCard } from "@/types/booking-cards";
import {
  BOOKING_CHAT_CLIENT_ABORT_MS,
  BOOKING_CHAT_ERRORS,
  BOOKING_CHAT_HISTORY_ITEM_MAX,
  BOOKING_CHAT_HISTORY_LIMIT,
  type BookingChatRequest,
  type QuoteAcceptedEvent,
  type QuoteAcceptResponse,
} from "@/types/booking-chat";
import { parseSseEvent } from "@/types/sse";
import type { StreamChatMessage } from "./use-stream-chat";
import { readSseStream } from "./use-sse-stream";

/** Client-side state of a quote card after its accept button was pressed. */
export type QuoteState = "accepting" | "expired" | "noCapacity" | "failed";

const ERROR_MESSAGES: Record<string, string> = {
  [BOOKING_CHAT_ERRORS.limitReached]: "booking.access.limitReached",
  [BOOKING_CHAT_ERRORS.aiUnavailable]: "booking.chat.aiUnavailable",
  response_timeout: "chat.error_timeout",
};

let nextId = 0;
const newId = () => `booking-${Date.now()}-${nextId++}`;

/**
 * The booking conversation (PayPal hackathon plan, Phase 3). Same message
 * shape as useStreamChat, plus cards per assistant message, a transient tool
 * status line and the quote accept flow.
 *
 * Each turn sends the last BOOKING_CHAT_HISTORY_LIMIT messages as history.
 * Accepting a quote swaps its card for the booking card and immediately sends
 * a quote_accepted turn with no typed text, so the visitor never has to say
 * what happens next (F06).
 */
export function useBookingChat() {
  const { session } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<StreamChatMessage[]>([]);
  const messagesRef = useRef<StreamChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [quoteStates, setQuoteStates] = useState<Record<string, QuoteState>>({});
  // One turn at a time: a second turn or an accept mid-stream would run two
  // model loops on one draft and spend two chat turns.
  const busyRef = useRef(false);

  const updateMessages = useCallback((update: (prev: StreamChatMessage[]) => StreamChatMessage[]) => {
    setMessages((prev) => {
      const next = update(prev);
      messagesRef.current = next;
      return next;
    });
  }, []);

  const headers = useCallback(
    (): Record<string, string> => ({
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...csrfHeaders(),
    }),
    [session?.access_token]
  );

  const sendTurn = useCallback(
    async (text: string, locale: string | undefined, event?: QuoteAcceptedEvent) => {
      if (busyRef.current) return;
      busyRef.current = true;
      const history = messagesRef.current
        .filter((message) => message.content.trim())
        .slice(-BOOKING_CHAT_HISTORY_LIMIT)
        .map((message) => ({ role: message.role, content: message.content.slice(0, BOOKING_CHAT_HISTORY_ITEM_MAX) }));
      const assistantId = newId();
      updateMessages((prev) => [
        ...prev,
        ...(text ? [{ id: newId(), role: "user" as const, content: text }] : []),
        { id: assistantId, role: "assistant", content: "" },
      ]);
      const patchAssistant = (patch: (message: StreamChatMessage) => StreamChatMessage) =>
        updateMessages((prev) => prev.map((message) => (message.id === assistantId ? patch(message) : message)));

      // Text tokens are buffered and applied once per animation frame (as in
      // useStreamChat, PE-M4): one state update per token re-renders and
      // re-parses the markdown of the whole message every token.
      let pendingText = "";
      let frame: number | null = null;
      const flushText = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        if (!pendingText) return;
        const text = pendingText;
        pendingText = "";
        patchAssistant((message) => ({ ...message, content: message.content + text }));
      };

      setIsStreaming(true);
      setError(null);
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), BOOKING_CHAT_CLIENT_ABORT_MS);
      const body: BookingChatRequest = { message: text, history, ...(locale ? { locale } : {}), ...(event ? { event } : {}) };

      try {
        const response = await fetch("/api/booking/chat/stream", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          setError(t(response.status === 429 ? "booking.chat.rateLimited" : "chat.error_generic"));
          return;
        }
        if (response.headers.get("content-type")?.includes("application/json")) {
          // Flagged input: the server answers with a fixed redirect message.
          const flagged = (await response.json()) as { message?: string };
          patchAssistant((message) => ({ ...message, content: flagged.message ?? "" }));
          return;
        }

        await readSseStream(response.body, {
          onEvent(line) {
            const parsed = parseSseEvent(line);
            if (!parsed) return;
            if (parsed.type === "text") {
              pendingText += parsed.content;
              frame ??= requestAnimationFrame(flushText);
              return;
            }
            // Keep text and cards in order: apply buffered text first.
            flushText();
            if (parsed.type === "tool") {
              setStatusLine(parsed.status === "start" ? t("booking.chat.checking") : null);
            } else if (parsed.type === "card") {
              patchAssistant((message) => ({ ...message, cards: [...(message.cards ?? []), parsed.card] }));
            } else if (parsed.type === "error") {
              setError(t(ERROR_MESSAGES[parsed.message] ?? "chat.error_generic"));
            }
          },
          onDone() {},
          onError(streamError) {
            throw streamError;
          },
        });
      } catch {
        setError(t(controller.signal.aborted ? "chat.error_timeout" : "chat.error_generic"));
      } finally {
        flushText();
        clearTimeout(abortTimer);
        busyRef.current = false;
        setStatusLine(null);
        setIsStreaming(false);
        // Drop an assistant bubble that never received text or cards.
        updateMessages((prev) =>
          prev.filter((message) => message.id !== assistantId || message.content || message.cards?.length)
        );
      }
    },
    [headers, t, updateMessages]
  );

  const sendMessage = useCallback(
    async (message: string, options?: { locale?: string }) => {
      const text = message.trim();
      if (!text) return;
      await sendTurn(text, options?.locale);
    },
    [sendTurn]
  );

  const acceptQuote = useCallback(
    async (quoteId: string, locale?: string) => {
      if (busyRef.current) return;
      setQuoteStates((prev) => ({ ...prev, [quoteId]: "accepting" }));
      let response: Response;
      try {
        response = await fetch(`/api/booking/quotes/${quoteId}/accept`, { method: "POST", headers: headers() });
      } catch {
        setQuoteStates((prev) => ({ ...prev, [quoteId]: "failed" }));
        return;
      }

      if (response.status === 409) {
        const { error: code } = (await response.json().catch(() => ({}))) as { error?: string };
        setQuoteStates((prev) => ({ ...prev, [quoteId]: code === "no_capacity" ? "noCapacity" : "expired" }));
        return;
      }
      if (!response.ok) {
        if (response.status === 429) setError(t("booking.access.limitReached"));
        setQuoteStates((prev) => ({ ...prev, [quoteId]: "failed" }));
        return;
      }

      const { card } = (await response.json()) as QuoteAcceptResponse;
      setQuoteStates((prev) => {
        const next = { ...prev };
        delete next[quoteId];
        return next;
      });
      updateMessages((prev) =>
        prev.map((message) =>
          message.cards?.some((existing) => existing.kind === "quote" && existing.quoteId === quoteId)
            ? {
                ...message,
                cards: message.cards.map((existing): BookingCard =>
                  existing.kind === "quote" && existing.quoteId === quoteId ? card : existing
                ),
              }
            : message
        )
      );
      await sendTurn("", locale, { type: "quote_accepted", bookingId: card.bookingId });
    },
    [headers, sendTurn, t, updateMessages]
  );

  const resetMessages = useCallback(() => {
    updateMessages(() => []);
    setError(null);
    setQuoteStates({});
  }, [updateMessages]);

  // The booking chat shows no upsell; kept for VoiceChat's shared props.
  const dismissUpsell = useCallback(() => {}, []);

  return {
    messages,
    messagesRef,
    isStreaming,
    error,
    statusLine,
    quoteStates,
    sendMessage,
    acceptQuote,
    resetMessages,
    dismissUpsell,
  };
}
