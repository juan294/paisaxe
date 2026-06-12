"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { ChatMessageSkeleton } from "@/components/immersive/skeleton-chat-message";
import { ChatUpsellCTA } from "@/components/immersive/chat-upsell-cta";
import { useTranslation } from "@/lib/i18n";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ChatMarkdown } from "./chat-markdown";
import type { StreamChatMessage } from "@/hooks/use-stream-chat";

interface ChatMessageListProps {
  messages: StreamChatMessage[];
  isLoading: boolean;
  onUpsellDismiss: (index: number) => void;
}

/**
 * ChatMessageList — the scrollable message log inside VoiceChat.
 *
 * Renders user and assistant messages, inline images, upsell CTAs, and a
 * loading skeleton. Auto-scrolls to the bottom after each message, respecting
 * the user's prefers-reduced-motion preference.
 */
export function ChatMessageList({
  messages,
  isLoading,
  onUpsellDismiss,
}: ChatMessageListProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on message changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [messages, prefersReducedMotion]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-busy={isLoading}
      aria-label={t("accessibility.chat_messages")}
      className="h-64 md:h-96 lg:h-[28rem] overflow-y-auto p-4 space-y-4"
    >
      {messages.length === 0 && (
        <div className="text-center text-white/50 py-8">
          <p>{t("chat.empty_state")}</p>
        </div>
      )}
      {messages.map((msg, idx) => (
        <div key={msg.id}>
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
              <ChatMarkdown content={msg.content} />
            )}
            {msg.images && msg.images.length > 0 && (
              <div className="mt-3 space-y-3">
                {msg.images.map((image) => (
                  <figure key={image.id} className="overflow-hidden rounded-xl">
                    <Image
                      src={image.path}
                      alt={image.caption || t("chat.image_alt")}
                      width={400}
                      height={300}
                      sizes="(max-width: 640px) 100vw, 400px"
                      className="w-full rounded-xl object-cover"
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
              onDismiss={() => onUpsellDismiss(idx)}
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
  );
}
