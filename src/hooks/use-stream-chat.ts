"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ImageResult } from "@/types";
import { useTranslation } from "@/lib/i18n";
import {
  detectUpsellMarker,
  type UpsellReason,
} from "@/lib/chat-upsell-detection";
import {
  canShowUpsell,
  recordUpsellShown,
  recordUpsellDismissed,
} from "@/lib/chat-upsell-throttle";
import { csrfHeaders } from "@/lib/csrf-client";
import { parseSseEvent } from "@/types/sse";
import { readSseStream } from "./use-sse-stream";
import { MAX_CONVERSATION_TURNS } from "@/lib/chat-safety";

// Sentinel: thrown when the error state has already been set so the outer
// catch handler knows to skip the generic setError call.
class HandledError extends Error {
  constructor() {
    super("already handled");
    this.name = "HandledError";
  }
}

export interface StreamChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: ImageResult[];
  upsellReason?: UpsellReason;
  upsellDismissed?: boolean;
}

interface SendMessageOptions {
  context: string;
  locale: string;
  messageIndex: number;
}

interface UseStreamChatOptions {
  canUseVoice: boolean;
}

export function useStreamChat({ canUseVoice }: UseStreamChatOptions) {
  const [messages, setMessages] = useState<StreamChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const abortControllerRef = useRef<AbortController | null>(null);

  // FE-M1: mirrors `messages` for reads that must not force `sendMessage` to
  // be recreated on every token. Updated synchronously inside the SAME
  // setState updater call below (never via a separate useEffect, which would
  // lag a render behind and could let the turn-cap check below read a stale
  // count).
  const messagesRef = useRef<StreamChatMessage[]>([]);
  const updateMessages = useCallback(
    (
      updater:
        | StreamChatMessage[]
        | ((prev: StreamChatMessage[]) => StreamChatMessage[])
    ) => {
      setMessages((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        messagesRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const resetMessages = useCallback(() => {
    updateMessages([]);
  }, [updateMessages]);

  const dismissUpsell = useCallback(
    (messageIndex: number) => {
      recordUpsellDismissed(messageIndex);
      updateMessages((prev) => {
        const updated = [...prev];
        if (updated[messageIndex]) {
          updated[messageIndex] = {
            ...updated[messageIndex],
            upsellDismissed: true,
          };
        }
        return updated;
      });
    },
    [updateMessages]
  );

  const sendMessage = useCallback(
    async (message: string, options: SendMessageOptions) => {
      if (!message.trim() || isStreaming) return;

      // FE-M3: enforce 20-turn (40 message) cap client-side
      // Each turn = 1 user + 1 assistant message, so 20 turns = 40 messages.
      // FE-M1: read via messagesRef (not `messages`) so this stays correct
      // without pulling `messages` into sendMessage's dep array.
      if (messagesRef.current.length >= MAX_CONVERSATION_TURNS * 2) {
        updateMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: t("chat.new_chat_prompt"),
          },
        ]);
        return;
      }

      const userMessage = message.trim();
      setError(null);

      // Abort any previous in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 60_000);

      // Add both messages atomically; capture the assistant index from actual prev state
      let assistantIndex = 0;
      updateMessages((prev) => {
        const updated: StreamChatMessage[] = [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: userMessage },
          { id: crypto.randomUUID(), role: "assistant", content: "" },
        ];
        assistantIndex = updated.length - 1;
        return updated;
      });
      setIsStreaming(true);

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            message: userMessage,
            context: options.context,
            locale: options.locale,
            messageIndex: options.messageIndex,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // FE-H2: differentiate error types so the user gets actionable guidance
          if (response.status === 401) {
            setError(t("chat.error_auth"));
          } else if (response.status >= 500) {
            setError(t("chat.error_server"));
          } else {
            setError(t("chat.error"));
          }
          throw new HandledError();
        }

        // Check if we got a non-streaming JSON response (e.g., for flagged content)
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const data = await response.json();
          updateMessages((prev) => {
            const updated = [...prev];
            updated[assistantIndex] = {
              ...updated[assistantIndex],
              role: "assistant",
              content: data.message || t("chat.error_processing"),
              images: data.images,
            };
            return updated;
          });
          return;
        }

        // Handle streaming response
        if (!response.body) throw new Error("No reader");

        const processEvent = (line: string) => {
          const event = parseSseEvent(line);
          if (!event) {
            return;
          }

          if (event.type === "text") {
            updateMessages((prev) => {
              const updated = [...prev];
              const current = updated[assistantIndex];
              updated[assistantIndex] = {
                ...current,
                content: current.content + event.content,
              };
              return updated;
            });
          } else if (event.type === "done") {
            updateMessages((prev) => {
              const updated = [...prev];
              const currentMsg = updated[assistantIndex];
              const { hasUpsell, reason, cleanContent } = detectUpsellMarker(
                currentMsg.content
              );

              const shouldShowUpsell =
                hasUpsell && !canUseVoice && canShowUpsell(assistantIndex);

              if (shouldShowUpsell) {
                recordUpsellShown();
              }

              updated[assistantIndex] = {
                ...currentMsg,
                content: cleanContent,
                images: event.images,
                upsellReason: shouldShowUpsell ? reason ?? undefined : undefined,
              };
              return updated;
            });
          } else {
            // event.type === "error" — the only remaining member of the
            // ChatStreamEvent union once "text" and "done" are ruled out.
            // FE-H2: differentiate server-side error messages
            const isTimeout =
              event.message === "response_timeout" ||
              event.message === "search_unavailable";
            updateMessages((prev) => {
              const updated = [...prev];
              const current = updated[assistantIndex];

              updated[assistantIndex] = {
                ...current,
                role: "assistant",
                content: isTimeout
                  ? t("chat.error_timeout")
                  : t("chat.error_generic"),
                images: current?.images,
              };
              return updated;
            });
          }
        };

        await readSseStream(response.body, {
          onEvent: processEvent,
          onDone: () => {
            // Stream ended cleanly — no action needed here; all state is
            // managed incrementally inside processEvent callbacks.
          },
          onError: (err) => {
            // FE-H2: AbortError from connection loss surfaces to the user
            if (err.name === "AbortError") {
              if (controller.signal.aborted) {
                setError(t("chat.connection_lost"));
              }
              return;
            }
            setError(t("chat.error"));
            updateMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantIndex]) {
                updated[assistantIndex] = {
                  ...updated[assistantIndex],
                  role: "assistant",
                  content: t("chat.error_generic"),
                };
              } else {
                updated.push({
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: t("chat.error_generic"),
                });
              }
              return updated;
            });
          },
        });
      } catch (err) {
        // Error already handled (error state already set) — skip the generic handler
        if (err instanceof HandledError) {
          updateMessages((prev) => {
            const updated = [...prev];
            if (updated[assistantIndex]) {
              updated[assistantIndex] = {
                ...updated[assistantIndex],
                role: "assistant",
                content: t("chat.error_generic"),
              };
            }
            return updated;
          });
          return;
        }
        // FE-H2: AbortError from the 60s timeout should surface to the user;
        // AbortError from unmount/navigation should be silent.
        if (err instanceof Error && err.name === "AbortError") {
          // If the controller was aborted because the timeout fired, tell the user.
          // We distinguish by checking whether the 60s timer was the cause:
          // the timeout fires controller.abort() BEFORE rejecting fetch, so
          // controller.signal.aborted is true and the timeout has already fired.
          if (controller.signal.aborted) {
            setError(t("chat.connection_lost"));
            updateMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantIndex]) {
                updated[assistantIndex] = {
                  ...updated[assistantIndex],
                  role: "assistant",
                  content: t("chat.error_timeout"),
                };
              } else {
                updated.push({
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: t("chat.error_timeout"),
                });
              }
              return updated;
            });
          }
          return;
        }
        setError(t("chat.error"));
        updateMessages((prev) => {
          const updated = [...prev];
          if (updated[assistantIndex]) {
            updated[assistantIndex] = {
              ...updated[assistantIndex],
              role: "assistant",
              content: t("chat.error_generic"),
            };
          } else {
            updated.push({
              id: crypto.randomUUID(),
              role: "assistant",
              content: t("chat.error_generic"),
            });
          }
          return updated;
        });
      } finally {
        clearTimeout(timeoutId);
        setIsStreaming(false);
      }
    },
    // FE-M1: `messages` deliberately excluded — the only read was the
    // turn-cap length check above, which now reads `messagesRef.current`
    // (kept in sync by `updateMessages`). Depending on `messages` directly
    // made this callback's identity change on every streamed token, since
    // every "text" SSE event calls updateMessages with a new array.
    [isStreaming, canUseVoice, t, updateMessages]
  );

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    resetMessages,
    dismissUpsell,
  };
}
