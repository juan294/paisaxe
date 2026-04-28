"use client";

import { useState, useRef, useMemo } from "react";
import { Phone, MapPin, Copy, Check } from "lucide-react";
import { detectChatActions } from "@/lib/chat-action-detection";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatActionsProps {
  messages: Message[];
  isLoading?: boolean;
}

export function ChatActions({ messages, isLoading = false }: ChatActionsProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
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

  // Don't render anything if no messages or still loading
  if (messages.length === 0 || isLoading) {
    return null;
  }

  const handleCopy = async () => {
    // Format conversation for clipboard
    const userLabel = t("voice.you");
    const assistantLabel = t("chat.assistant_label");
    const conversationText = messages
      .map((msg) => {
        const label = msg.role === "user" ? userLabel : assistantLabel;
        return `${label}: ${msg.content}`;
      })
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(conversationText);
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopied(true);
      setCopyError(false);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // UX-L3 (#523): Show brief error feedback instead of silently ignoring
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopyError(true);
      timerRef.current = setTimeout(() => setCopyError(false), 2000);
    }
  };

  // Icon-only button style
  const iconButtonClass = cn(
    "p-2 rounded-full",
    "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
    "text-white",
    "transition-all duration-200 motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
    // Smooth fade-in animation
    "animate-in fade-in slide-in-from-bottom-2 duration-300"
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-white/10">
        {/* Call buttons */}
        {actions.phones.map((phone, index) => (
          <Tooltip key={`phone-${index}`}>
            <TooltipTrigger asChild>
              <a
                href={`tel:${phone.number}`}
                aria-label={`${t("chat.call")} ${phone.display}`}
                className={iconButtonClass}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Phone className="h-4 w-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              {t("chat.call")} {phone.display}
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Directions button - only show first/primary address */}
        {actions.addresses.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={actions.addresses[0].mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t("chat.directions")} - ${actions.addresses[0].text}`}
                className={iconButtonClass}
                style={{ animationDelay: `${actions.phones.length * 50}ms` }}
              >
                <MapPin className="h-4 w-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              {t("chat.directions")}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Copy conversation button - always visible when messages exist */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleCopy}
              aria-label={t("chat.copy_conversation")}
              className={iconButtonClass}
              style={{ animationDelay: `${(actions.phones.length + (actions.addresses.length > 0 ? 1 : 0)) * 50}ms` }}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {copied
              ? t("chat.copied")
              : copyError
                ? t("chat.copy_error")
                : t("chat.copy_conversation")}
          </TooltipContent>
        </Tooltip>
        {/* UX-L3: Inline error message when clipboard fails (visible without hover) */}
        {copyError && (
          <span role="alert" className="text-xs text-white/70 px-1">
            {t("chat.copy_error")}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
