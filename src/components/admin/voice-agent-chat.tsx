"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  MessageSquare,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { clientLogger } from "@/lib/client-logger";
import type { MarketingPlatform } from "@/types/marketing";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Agent {
  id: string;
  name: string;
  platform: MarketingPlatform;
  description: string;
  elevenLabsAgentId?: string;
}

// Platform letter badges for Swiss Minimal aesthetic
const PLATFORM_BADGES: Record<MarketingPlatform, string> = {
  x: "X",
  instagram: "IG",
  pinterest: "Pi",
};

// Agent IDs are passed as props from the parent component
// which loads them from the config file

interface VoiceAgentChatProps {
  agentIds?: Record<string, string>;
}

export function VoiceAgentChat({ agentIds = {} }: VoiceAgentChatProps) {
  const [agents] = useState<Agent[]>([
    {
      id: "xander",
      name: "Xander",
      platform: "x",
      description: "X specialist - tweets, threads, engagement",
      elevenLabsAgentId: agentIds.xander,
    },
    {
      id: "iris",
      name: "Iris",
      platform: "instagram",
      description: "Instagram specialist - visuals, Reels, Stories",
      elevenLabsAgentId: agentIds.iris,
    },
    {
      id: "penny",
      name: "Penny",
      platform: "pinterest",
      description: "Pinterest specialist - SEO, evergreen content",
      elevenLabsAgentId: agentIds.penny,
    },
  ]);

  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isTextMode, setIsTextMode] = useState(false);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      addMessage("assistant", `Connected! I'm ${selectedAgent.name}, ready to help.`);
    },
    onDisconnect: () => {
      // Connection ended
    },
    onMessage: (message) => {
      if (message.message) {
        addMessage(
          message.source === "user" ? "user" : "assistant",
          message.message
        );
      }
    },
    onError: (error) => {
      clientLogger.error("[VOICE_AGENT_CONVERSATION_ERROR]", { error: String(error) });
      setError("Connection error. Try again or switch to text mode.");
    },
  });

  const { status, isSpeaking } = conversation;
  const isConnected = status === "connected";

  const prefersReducedMotion = useReducedMotion();

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content, timestamp: new Date() },
    ]);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [prefersReducedMotion]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleAgentChange = async (agent: Agent) => {
    // End current conversation if active
    if (isConnected) {
      await conversation.endSession();
    }
    setSelectedAgent(agent);
    setMessages([]);
    setError(null);
  };

  const startVoiceCall = async () => {
    if (!selectedAgent.elevenLabsAgentId) {
      setError("Voice not configured for this agent. Using text mode.");
      setIsTextMode(true);
      return;
    }

    try {
      setError(null);

      // Request mic permission on click — not on mount (UX-H1)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasPermission(true);
      } catch {
        setHasPermission(false);
        return;
      }

      await conversation.startSession({
        agentId: selectedAgent.elevenLabsAgentId,
        connectionType: "websocket",
      });
    } catch (err) {
      clientLogger.error("Failed to start voice call", { error: err instanceof Error ? err.message : String(err) });
      setError("Failed to connect. Check your microphone permissions.");
    }
  };

  const endVoiceCall = async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      clientLogger.error("Failed to end call", { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    conversation.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  // Text mode fallback
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isTextLoading) return;

    const userMessage = textInput.trim();
    setTextInput("");
    addMessage("user", userMessage);
    setIsTextLoading(true);

    try {
      // If connected to voice, send as text message
      if (isConnected) {
        conversation.sendUserMessage(userMessage);
      } else {
        // Use the existing text API
        const response = await fetch("/api/admin/marketing/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            agentId: selectedAgent.id,
            message: userMessage,
            conversationHistory: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        const data = await response.json();
        addMessage("assistant", data.response);
      }
    } catch {
      addMessage(
        "assistant",
        "Sorry, I encountered an error. Please try again."
      );
    } finally {
      setIsTextLoading(false);
    }
  };

  const voiceConfigured = !!selectedAgent.elevenLabsAgentId;

  return (
    <div className="border border-[#e5e3de] p-6 dark:border-[#3d3a36]">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-[#e5e3de] pb-4 dark:border-[#3d3a36]">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            {isTextMode ? "Text Mode" : "Voice Mode"}
          </p>
        </div>

        {/* Mode Toggle */}
        <button
          onClick={() => setIsTextMode(!isTextMode)}
          className="font-mono text-xs uppercase tracking-widest text-[#a39e98] transition-colors hover:text-[#2d2a26] dark:hover:text-[#f5f3ee]"
        >
          {isTextMode ? "Switch to Voice" : "Switch to Text"}
        </button>
      </div>

      {/* Agent Selector */}
      <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => handleAgentChange(agent)}
            disabled={isConnected}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border px-4 py-2 transition-all",
              selectedAgent.id === agent.id
                ? "border-[#2d2a26] bg-[#2d2a26] text-white dark:border-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                : "border-[#e5e3de] text-[#6b6560] hover:border-[#a39e98] dark:border-[#4d4944] dark:text-[#a39e98] dark:hover:border-[#6b6560]",
              isConnected && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center border border-current font-mono text-[9px] font-medium">
              {PLATFORM_BADGES[agent.platform]}
            </span>
            <span className="font-mono text-xs uppercase tracking-widest">{agent.name}</span>
            {!agent.elevenLabsAgentId && (
              <span className="font-mono text-[10px] opacity-60">(text)</span>
            )}
          </button>
        ))}
      </div>

      {/* Voice Call Interface */}
      {!isTextMode && (
        <div className="mb-6">
          {/* Permission Warning */}
          {hasPermission === false && (
            <div className="mb-4 flex items-center gap-3 font-mono text-xs text-amber-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>Microphone access denied. Please enable it in your browser settings.</p>
            </div>
          )}

          {/* Voice Config Warning */}
          {!voiceConfigured && (
            <div className="mb-4 flex items-center gap-3 font-mono text-xs text-blue-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>Voice not configured. Run the setup script first, or use text mode.</p>
            </div>
          )}

          {/* Call Controls */}
          <div className="flex items-center gap-6 border border-[#e5e3de] p-6 dark:border-[#3d3a36]">
            {/* Agent Avatar */}
            <div className="relative">
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center border-2 font-mono text-xl font-medium transition-all",
                  isConnected
                    ? "border-[#2d2a26] text-[#2d2a26] dark:border-[#f5f3ee] dark:text-[#f5f3ee]"
                    : "border-[#a39e98] text-[#a39e98]",
                  isConnected && isSpeaking && "animate-pulse"
                )}
              >
                {PLATFORM_BADGES[selectedAgent.platform]}
              </div>
              {isConnected && (
                <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-500" />
              )}
            </div>

            {/* Status & Controls */}
            <div className="flex flex-col items-start gap-3">
              <div>
                <p className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                  {selectedAgent.name}
                </p>
                <p className="font-mono text-xs text-[#a39e98]">
                  {isConnected
                    ? isSpeaking
                      ? "Speaking..."
                      : "Listening..."
                    : "Ready to call"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isConnected ? (
                  <button
                    onClick={startVoiceCall}
                    disabled={!voiceConfigured || hasPermission === false}
                    className={cn(
                      "flex items-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all",
                      voiceConfigured && hasPermission !== false
                        ? "border-[#2d2a26] text-[#2d2a26] hover:bg-[#2d2a26] hover:text-white dark:border-[#f5f3ee] dark:text-[#f5f3ee] dark:hover:bg-[#f5f3ee] dark:hover:text-[#2d2a26]"
                        : "cursor-not-allowed border-[#e5e3de] text-[#a39e98]"
                    )}
                  >
                    <Phone className="h-3 w-3" />
                    Start Call
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleMute}
                      aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center border transition-all",
                        isMuted
                          ? "border-red-500 bg-red-500 text-white"
                          : "border-[#e5e3de] text-[#6b6560] hover:border-[#a39e98] dark:border-[#4d4944]"
                      )}
                    >
                      {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    </button>

                    <button
                      onClick={endVoiceCall}
                      className="flex items-center gap-2 border border-red-500 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-500 transition-all hover:bg-red-500 hover:text-white"
                    >
                      <PhoneOff className="h-3 w-3" />
                      End
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 flex items-center gap-3 font-mono text-xs text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Messages / Transcript */}
      <div className="mb-4 h-[250px] overflow-y-auto border border-[#e5e3de] p-4 dark:border-[#3d3a36]">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center font-mono text-xs text-[#a39e98]">
              {isTextMode ? (
                <>
                  Start a conversation with {selectedAgent.name}
                  <br />
                  <span className="text-[#a39e98]">Type your message below</span>
                </>
              ) : (
                <>
                  Click &quot;Start Call&quot; to begin
                  <br />
                  <span className="text-[#a39e98]">Or switch to text mode</span>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 flex-shrink-0 items-center justify-center border font-mono text-[9px] font-medium",
                    message.role === "user"
                      ? "border-[#2d2a26] text-[#2d2a26] dark:border-[#f5f3ee] dark:text-[#f5f3ee]"
                      : "border-[#a39e98] text-[#6b6560]"
                  )}
                >
                  {message.role === "user" ? "U" : PLATFORM_BADGES[selectedAgent.platform]}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] border px-3 py-2 text-sm",
                    message.role === "user"
                      ? "border-[#2d2a26] bg-[#2d2a26] text-white dark:border-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                      : "border-[#e5e3de] text-[#4d4944] dark:border-[#4d4944] dark:text-[#a39e98]"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isTextLoading && (
              <div className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center border border-[#a39e98] font-mono text-[9px] font-medium text-[#6b6560]">
                  {PLATFORM_BADGES[selectedAgent.platform]}
                </div>
                <div className="flex items-center gap-2 border border-[#e5e3de] px-3 py-2 dark:border-[#4d4944]">
                  <Loader2 className="h-3 w-3 animate-spin text-[#a39e98]" />
                  <span className="font-mono text-xs text-[#a39e98]">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Text Input (always available as fallback) */}
      <form onSubmit={handleTextSubmit} className="flex gap-2">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={
            isConnected
              ? "Type while on call..."
              : `Message ${selectedAgent.name}...`
          }
          className="flex-1 border border-[#e5e3de] bg-transparent px-4 py-3 text-sm text-[#2d2a26] placeholder-[#a39e98] focus-visible:border-[#a39e98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a55c] dark:border-[#4d4944] dark:text-[#f5f3ee]"
          disabled={isTextLoading}
        />
        <button
          type="submit"
          disabled={!textInput.trim() || isTextLoading}
          className={cn(
            "flex h-12 w-12 items-center justify-center border transition-all",
            textInput.trim() && !isTextLoading
              ? "border-[#2d2a26] bg-[#2d2a26] text-white hover:bg-[#3d3a36] dark:border-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
              : "border-[#e5e3de] text-[#a39e98] dark:border-[#4d4944]"
          )}
        >
          {isTextLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
        </button>
      </form>

      {/* Help Text */}
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-[#a39e98]">
        {isTextMode
          ? "Voice mode available above"
          : "Text input always available"}
      </p>
    </div>
  );
}
