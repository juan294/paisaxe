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

interface StreamChatMessage {
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

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const resetMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const dismissUpsell = useCallback((messageIndex: number) => {
    recordUpsellDismissed(messageIndex);
    setMessages((prev) => {
      const updated = [...prev];
      if (updated[messageIndex]) {
        updated[messageIndex] = {
          ...updated[messageIndex],
          upsellDismissed: true,
        };
      }
      return updated;
    });
  }, []);

  const sendMessage = useCallback(
    async (message: string, options: SendMessageOptions) => {
      if (!message.trim() || isStreaming) return;

      const userMessage = message.trim();
      setError(null);

      // Abort any previous in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 60_000);

      // Add both messages atomically; capture the assistant index from actual prev state
      let assistantIndex = 0;
      setMessages((prev) => {
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
          setError(t("chat.error"));
          throw new Error("Failed");
        }

        // Check if we got a non-streaming JSON response (e.g., for flagged content)
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const data = await response.json();
          setMessages((prev) => {
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
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let buffer = "";

        const processEvent = (line: string) => {
          const event = parseSseEvent(line);
          if (!event) {
            return;
          }

          if (event.type === "text") {
            setMessages((prev) => {
              const updated = [...prev];
              const current = updated[assistantIndex];
              updated[assistantIndex] = {
                ...current,
                content: current.content + event.content,
              };
              return updated;
            });
          } else if (event.type === "done") {
            setMessages((prev) => {
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
          } else if (event.type === "error") {
            setMessages((prev) => {
              const updated = [...prev];
              const current = updated[assistantIndex];

              updated[assistantIndex] = {
                ...current,
                role: "assistant",
                content: t("chat.error_generic"),
                images: current?.images,
              };
              return updated;
            });
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            processEvent(line);
          }
        }

        // Process any remaining buffer content after stream ends
        if (buffer.trim()) {
          processEvent(buffer.trim());
        }
      } catch (err) {
        // Ignore AbortError (user navigated away or timeout fired)
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(t("chat.error"));
        setMessages((prev) => {
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
    [isStreaming, canUseVoice, t]
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
