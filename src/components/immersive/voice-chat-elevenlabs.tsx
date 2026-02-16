"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { Mic, MicOff, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { getLocalizedStory } from "@/lib/localize-story";
import { useVoiceSession } from "@/hooks/use-voice-session";
import type { Story } from "@/types/immersive";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface VoiceChatElevenLabsProps {
  story: Story;
  agentId: string;
  onFallbackToText: () => void;
  userAccessToken?: string | null;
}

// Animated orb component for voice visualization
function VoiceOrb({
  isActive,
  isSpeaking,
  isConnecting
}: {
  isActive: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
}) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer animated rings */}
      {isActive && (
        <>
          <div
            className={cn(
              "absolute h-32 w-32 rounded-full opacity-20",
              "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500",
              isSpeaking ? "animate-[pulse_1s_ease-in-out_infinite]" : "animate-[spin_8s_linear_infinite]"
            )}
            style={{
              background: "conic-gradient(from 0deg, #fbbf24, #fde047, #f59e0b, #fbbf24)",
            }}
          />
          <div
            className={cn(
              "absolute h-28 w-28 rounded-full opacity-30",
              "animate-[spin_6s_linear_infinite_reverse]"
            )}
            style={{
              background: "conic-gradient(from 180deg, #fde047, #fbbf24, #f59e0b, #fde047)",
            }}
          />
        </>
      )}

      {/* Middle glow */}
      <div
        className={cn(
          "absolute h-24 w-24 rounded-full transition-all duration-500",
          isActive
            ? "bg-gradient-to-br from-amber-400/40 to-yellow-500/40 blur-sm"
            : "bg-white/5"
        )}
      />

      {/* Center button/indicator */}
      <div
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300",
          isActive
            ? "bg-white text-gray-900 shadow-lg shadow-amber-500/25"
            : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
        )}
      >
        {/* Animated sound bars */}
        <div className="flex items-center justify-center gap-[3px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "w-[3px] rounded-full bg-current transition-all",
                isConnecting && "animate-pulse",
                isActive && !isConnecting && "animate-soundbar"
              )}
              style={{
                height: isActive
                  ? [16, 24, 32, 24, 16][i]
                  : [12, 18, 24, 18, 12][i],
                animationDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function VoiceChatElevenLabs({
  story,
  agentId,
  onFallbackToText,
}: VoiceChatElevenLabsProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useTranslation();
  const localizedStory = getLocalizedStory(story, locale);

  // Voice session tracking for personalization
  const voiceSession = useVoiceSession();

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      addMessage(
        "assistant",
        t("voice.welcome_message").replace("{title}", localizedStory.title)
      );
    },
    onDisconnect: () => {
      // Increment conversation count when session ends
      voiceSession.incrementConversation();
    },
    onMessage: (message) => {
      if (message.message) {
        addMessage(
          message.source === "user" ? "user" : "assistant",
          message.message
        );
      }
    },
    onError: (err) => {
      console.error("Voice conversation error:", err);
      setError(t("voice.error"));
      onFallbackToText();
    },
  });

  const { status, isSpeaking } = conversation;
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      setMessages((prev) => [...prev, { role, content, timestamp: new Date() }]);
    },
    []
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check microphone permission
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => setHasPermission(true))
      .catch(() => setHasPermission(false));
  }, []);

  const startConversation = async () => {
    if (!agentId) {
      setError("Voice agent not configured");
      onFallbackToText();
      return;
    }

    try {
      setError(null);

      // Determine language override based on user's locale
      const languageOverride = voiceSession.preferredLanguage === "Spanish" ? "es" : "en";

      await conversation.startSession({
        agentId,
        connectionType: "websocket",
        dynamicVariables: {
          // Story context
          story_title: localizedStory.title,
          story_subtitle: localizedStory.subtitle,
          story_description: localizedStory.description,
          story_category: story.category || "general",
          story_location: story.location || "Asturias",

          // Session awareness
          conversation_count: String(voiceSession.conversationCount),
          is_returning: voiceSession.isReturning ? "true" : "false",

          // Language/locale
          user_locale: voiceSession.userLocale,
          preferred_language: voiceSession.preferredLanguage,

          // Time context
          time_of_day: voiceSession.timeOfDay,
          current_time: new Date().toLocaleTimeString(voiceSession.userLocale, {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        overrides: {
          agent: {
            language: languageOverride,
          },
        },
      });
    } catch (err) {
      console.error("Failed to start voice conversation:", err);
      setError(t("voice.error"));
      onFallbackToText();
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("Failed to end conversation:", err);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Get status text
  const getStatusText = () => {
    if (isConnecting) return t("voice.connecting");
    if (isConnected && isSpeaking) return t("voice.speaking");
    if (isConnected) return t("voice.listening");
    return t("voice.tap_to_talk");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Permission Warning */}
      {hasPermission === false && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-red-500/20 p-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{t("voice.no_permission")}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-red-500/20 p-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Voice Interface */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Voice Orb - clickable when not connected */}
        {!isConnected ? (
          <button
            onClick={startConversation}
            disabled={hasPermission === false || isConnecting}
            aria-label={t("voice.talk_to_me")}
            className={cn(
              "mb-6 transition-transform hover:scale-105 active:scale-95",
              (hasPermission === false || isConnecting) && "cursor-not-allowed opacity-50"
            )}
          >
            <VoiceOrb
              isActive={false}
              isSpeaking={false}
              isConnecting={isConnecting}
            />
          </button>
        ) : (
          <div className="mb-6">
            <VoiceOrb
              isActive={true}
              isSpeaking={isSpeaking}
              isConnecting={false}
            />
          </div>
        )}

        {/* Status Text */}
        <p className="mb-6 text-sm text-white/60">{getStatusText()}</p>

        {/* Controls when connected */}
        {isConnected && (
          <div className="flex items-center gap-3">
            {/* Mute button */}
            <button
              onClick={toggleMute}
              aria-label={isMuted ? t("voice.unmute") : t("voice.mute")}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-all",
                isMuted
                  ? "bg-red-500/50 text-white hover:bg-red-500/60"
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            {/* Stop button */}
            <button
              onClick={endConversation}
              aria-label={t("voice.stop")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

      </div>

      {/* Transcript */}
      {messages.length > 0 && (
        <div className="border-t border-white/10 p-4">
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "text-sm",
                  msg.role === "user" ? "text-white/80" : "text-white/60"
                )}
              >
                <span className="font-medium">
                  {msg.role === "user" ? t("voice.you") + ": " : "Pelayo: "}
                </span>
                {msg.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
