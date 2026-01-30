"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Story } from "@/types/immersive";
import { ImageResult } from "@/types";
import { cn } from "@/lib/utils";
import { X, Send, AudioLines, LogIn, Keyboard } from "lucide-react";
import { ChatMessageSkeleton } from "./skeleton-chat-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrivacyNotice } from "./privacy-notice";
import { ChatActions } from "./chat-actions";
import { useTranslation } from "@/lib/i18n";
import { getLocalizedStory } from "@/lib/localize-story";
import { useVisitorVoiceAccess } from "@/hooks/use-visitor-voice-access";
import { VoiceChatElevenLabs } from "./voice-chat-elevenlabs";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface VoiceChatProps {
  story: Story;
  open: boolean;
  onClose: () => void;
  initialMessage?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: ImageResult[];
}

export function VoiceChat({ story, open, onClose, initialMessage }: VoiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [useElevenLabs, setUseElevenLabs] = useState(false);
  const [hasSetDefaultMode, setHasSetDefaultMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useTranslation();
  const localizedStory = getLocalizedStory(story, locale);

  // Check for ElevenLabs voice access
  const { canUseVoice, needsSignIn, agentId, isLoading: isVoiceAccessLoading } = useVisitorVoiceAccess();

  // Set voice mode as default when user has access (only on first load)
  useEffect(() => {
    if (!isVoiceAccessLoading && !hasSetDefaultMode) {
      if (canUseVoice && agentId) {
        setUseElevenLabs(true);
      }
      setHasSetDefaultMode(true);
    }
  }, [isVoiceAccessLoading, canUseVoice, agentId, hasSetDefaultMode]);

  // Reset messages when story changes
  useEffect(() => {
    setMessages([]);
  }, [story.id]);

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

  const handleSignIn = async () => {
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  };

  const handleVoiceFallback = useCallback(() => {
    setUseElevenLabs(false);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    // Add empty assistant message that will be streamed into
    const assistantIndex = messages.length + 1; // +1 for the user message we just added
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          context: `The user is viewing: ${localizedStory.title} (${localizedStory.subtitle}). ${localizedStory.description}. Source: ${story.sourcePdf}.`,
          locale,
        }),
      });

      if (!response.ok) throw new Error("Failed");

      // Check if we got a non-streaming JSON response (e.g., for flagged content)
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIndex] = {
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Keep incomplete event in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr);

              if (event.type === "text") {
                // Append text chunk to the assistant message
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
                // Add images from final event
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[assistantIndex] = {
                    ...updated[assistantIndex],
                    images: event.images,
                  };
                  return updated;
                });
              } else if (event.type === "error") {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[assistantIndex] = {
                    role: "assistant",
                    content: t("chat.error_generic"),
                  };
                  return updated;
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[assistantIndex]) {
          updated[assistantIndex] = {
            role: "assistant",
            content: t("chat.error_generic"),
          };
        } else {
          updated.push({
            role: "assistant",
            content: t("chat.error_generic"),
          });
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
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
      <div className="relative w-full max-w-lg bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none">
        {/* Header with voice mode toggle */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex-1">
            <h2 className="font-semibold text-white">{localizedStory.title}</h2>
            <p className="text-sm text-white/60">{localizedStory.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Voice mode toggle - only show when user can use voice */}
            {canUseVoice && agentId && (
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

        {/* Sign-in prompt for voice access */}
        {needsSignIn && !useElevenLabs && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg bg-white/5 p-3 border border-white/10">
            <p className="text-sm text-white/70">{t(`voice.sign_in_prompt_${story.category}`)}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignIn}
              className="text-white hover:bg-white/10 text-xs gap-1.5 shrink-0"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t("voice.sign_in")}
            </Button>
          </div>
        )}

        {/* ElevenLabs Voice Chat or Text Chat */}
        {useElevenLabs && canUseVoice && agentId ? (
          <VoiceChatElevenLabs
            story={story}
            agentId={agentId}
            onFallbackToText={handleVoiceFallback}
          />
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
                <div
                  key={i}
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
                          <p className="mt-0.5 text-xs text-white/40">
                            {t("chat.source")}: {image.sourcePdf}
                          </p>
                        </figure>
                      ))}
                    </div>
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
              className="p-4 border-t border-white/10 flex gap-2"
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t("chat.placeholder")}
                aria-label={t("chat.placeholder")}
                disabled={isLoading}
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                aria-label={t("accessibility.send_message")}
                className="bg-white text-gray-900 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
