"use client";

import { useState, useRef, useMemo } from "react";
import { Phone, Navigation, Copy, Check } from "lucide-react";
import { detectChatActions } from "@/lib/chat-action-detection";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatActionsProps {
  messages: Message[];
}

export function ChatActions({ messages }: ChatActionsProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find the last assistant message
  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  // Detect actions in the last assistant message
  const actions = useMemo(() => {
    if (!lastAssistantMessage) {
      return { phones: [], addresses: [], hasActions: false };
    }
    return detectChatActions(lastAssistantMessage.content);
  }, [lastAssistantMessage]);

  // Don't render anything if no messages
  if (messages.length === 0) {
    return null;
  }

  const handleCopy = async () => {
    // Format conversation for clipboard
    const conversationText = messages
      .map((msg) => {
        const label = msg.role === "user" ? "You" : "Paisaxe";
        return `${label}: ${msg.content}`;
      })
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(conversationText);
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently ignore clipboard errors
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-t border-white/10">
      {/* Call buttons */}
      {actions.phones.map((phone, index) => (
        <a
          key={`phone-${index}`}
          href={`tel:${phone.number}`}
          aria-label={`${t("chat.call")} ${phone.display}`}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
            "text-white text-sm font-medium",
            "transition-colors motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          )}
        >
          <Phone className="h-3.5 w-3.5" />
          {t("chat.call")}
        </a>
      ))}

      {/* Directions buttons */}
      {actions.addresses.map((address, index) => (
        <a
          key={`address-${index}`}
          href={address.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t("chat.directions")} - ${address.text}`}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
            "text-white text-sm font-medium",
            "transition-colors motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          )}
        >
          <Navigation className="h-3.5 w-3.5" />
          {t("chat.directions")}
        </a>
      ))}

      {/* Copy conversation button - always visible when messages exist */}
      <button
        onClick={handleCopy}
        aria-label={t("chat.copy_conversation")}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
          "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
          "text-white text-sm font-medium",
          "transition-colors motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
          "ml-auto"
        )}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            {t("chat.copied")}
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            {t("chat.copy_conversation")}
          </>
        )}
      </button>
    </div>
  );
}
