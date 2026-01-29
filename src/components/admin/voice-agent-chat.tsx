"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
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
import type { MarketingPlatform } from "@/types/marketing";

interface Message {
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

const PLATFORM_COLORS: Record<MarketingPlatform, string> = {
  x: "bg-black dark:bg-white dark:text-black",
  instagram: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400",
  pinterest: "bg-red-600",
  tiktok: "bg-black dark:bg-white dark:text-black",
};

const PLATFORM_ICONS: Record<MarketingPlatform, string> = {
  x: "𝕏",
  instagram: "📷",
  pinterest: "📌",
  tiktok: "🎵",
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
    {
      id: "tiko",
      name: "Tiko",
      platform: "tiktok",
      description: "TikTok specialist - trends, hooks, authenticity",
      elevenLabsAgentId: agentIds.tiko,
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
      console.error("Conversation error:", error);
      setError("Connection error. Try again or switch to text mode.");
    },
  });

  const { status, isSpeaking } = conversation;
  const isConnected = status === "connected";

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: new Date() }]);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check microphone permission
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => setHasPermission(true))
      .catch(() => setHasPermission(false));
  }, []);

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
      await conversation.startSession({
        agentId: selectedAgent.elevenLabsAgentId,
        connectionType: "websocket",
      });
    } catch (err) {
      console.error("Failed to start voice call:", err);
      setError("Failed to connect. Check your microphone permissions.");
    }
  };

  const endVoiceCall = async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("Failed to end call:", err);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // The SDK handles muting internally based on state
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
          headers: { "Content-Type": "application/json" },
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
    <div className="rounded-3xl bg-white p-6 shadow-sm dark:bg-[#252320]">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
            Marketing Agents
          </h2>
          <p className="text-sm text-[#6b6560] dark:text-[#a39e98]">
            {isTextMode ? "Text chat mode" : "Voice-first conversation"}
          </p>
        </div>

        {/* Mode Toggle */}
        <button
          onClick={() => setIsTextMode(!isTextMode)}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
            isTextMode
              ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
              : "bg-[#f5f3ee] text-[#6b6560] dark:bg-[#2d2a26] dark:text-[#a39e98]"
          )}
        >
          {isTextMode ? (
            <>
              <MessageSquare className="h-4 w-4" />
              Text Mode
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Voice Mode
            </>
          )}
        </button>
      </div>

      {/* Agent Selector */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => handleAgentChange(agent)}
            disabled={isConnected}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
              selectedAgent.id === agent.id
                ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                : "bg-[#f5f3ee] text-[#6b6560] hover:bg-[#e5e3de] dark:bg-[#2d2a26] dark:text-[#a39e98] dark:hover:bg-[#3d3a36]",
              isConnected && "opacity-50 cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs text-white",
                PLATFORM_COLORS[agent.platform]
              )}
            >
              {PLATFORM_ICONS[agent.platform]}
            </span>
            {agent.name}
            {!agent.elevenLabsAgentId && (
              <span className="text-xs opacity-60">(text only)</span>
            )}
          </button>
        ))}
      </div>

      {/* Voice Call Interface */}
      {!isTextMode && (
        <div className="mb-6">
          {/* Permission Warning */}
          {hasPermission === false && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-[#c9a55c]/10 px-4 py-3 text-sm text-[#8b6c2e] dark:bg-[#c9a55c]/20 dark:text-[#d4b876]">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>Microphone access denied. Please enable it in your browser settings.</p>
            </div>
          )}

          {/* Voice Config Warning */}
          {!voiceConfigured && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-[#6b9bd2]/10 px-4 py-3 text-sm text-[#4a7ab8] dark:bg-[#6b9bd2]/20">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>
                Voice not configured. Run the setup script first, or use text mode.
              </p>
            </div>
          )}

          {/* Call Controls */}
          <div className="flex items-center justify-center gap-4 rounded-2xl bg-[#f5f3ee] p-6 dark:bg-[#1a1917]">
            {/* Agent Avatar with Orb Effect */}
            <div className="relative">
              <div
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white transition-all",
                  PLATFORM_COLORS[selectedAgent.platform],
                  isConnected && isSpeaking && "animate-pulse scale-110"
                )}
              >
                {PLATFORM_ICONS[selectedAgent.platform]}
              </div>
              {isConnected && (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#7a9e7a] text-white">
                  <Phone className="h-3 w-3" />
                </div>
              )}
            </div>

            {/* Status & Controls */}
            <div className="flex flex-col items-start gap-3">
              <div>
                <p className="font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                  {selectedAgent.name}
                </p>
                <p className="text-sm text-[#6b6560] dark:text-[#a39e98]">
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
                      "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                      voiceConfigured && hasPermission !== false
                        ? "bg-[#7a9e7a] text-white hover:bg-[#6a8e6a]"
                        : "bg-[#e5e3de] text-[#a39e98] cursor-not-allowed"
                    )}
                  >
                    <Phone className="h-4 w-4" />
                    Start Call
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleMute}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                        isMuted
                          ? "bg-[#c95c5c] text-white"
                          : "bg-[#e5e3de] text-[#6b6560] hover:bg-[#d5d3ce] dark:bg-[#2d2a26] dark:text-[#a39e98]"
                      )}
                    >
                      {isMuted ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      onClick={endVoiceCall}
                      className="flex items-center gap-2 rounded-xl bg-[#c95c5c] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#b94c4c]"
                    >
                      <PhoneOff className="h-4 w-4" />
                      End Call
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
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-[#c95c5c]/10 px-4 py-3 text-sm text-[#c95c5c]">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Messages / Transcript */}
      <div className="mb-4 h-[250px] overflow-y-auto rounded-xl bg-[#f5f3ee] p-4 dark:bg-[#1a1917]">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-[#a39e98]">
              {isTextMode ? (
                <>
                  Start a conversation with {selectedAgent.name}
                  <br />
                  <span className="text-xs">Type your message below</span>
                </>
              ) : (
                <>
                  Click "Start Call" to begin
                  <br />
                  <span className="text-xs">
                    Or switch to text mode for typing
                  </span>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm",
                    message.role === "user"
                      ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                      : PLATFORM_COLORS[selectedAgent.platform] + " text-white"
                  )}
                >
                  {message.role === "user"
                    ? "You"
                    : PLATFORM_ICONS[selectedAgent.platform]}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    message.role === "user"
                      ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                      : "bg-white text-[#2d2a26] dark:bg-[#252320] dark:text-[#f5f3ee]"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isTextLoading && (
              <div className="flex gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm",
                    PLATFORM_COLORS[selectedAgent.platform] + " text-white"
                  )}
                >
                  {PLATFORM_ICONS[selectedAgent.platform]}
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 dark:bg-[#252320]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#6b6560]" />
                  <span className="text-sm text-[#6b6560]">Thinking...</span>
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
          className="flex-1 rounded-xl border-0 bg-[#f5f3ee] px-4 py-3 text-sm text-[#2d2a26] placeholder-[#a39e98] focus:outline-none focus:ring-2 focus:ring-[#2d2a26]/20 dark:bg-[#2d2a26] dark:text-[#f5f3ee] dark:focus:ring-[#f5f3ee]/20"
          disabled={isTextLoading}
        />
        <button
          type="submit"
          disabled={!textInput.trim() || isTextLoading}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl transition-all",
            textInput.trim() && !isTextLoading
              ? "bg-[#2d2a26] text-[#f5f3ee] hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
              : "bg-[#e5e3de] text-[#a39e98] dark:bg-[#2d2a26] dark:text-[#6b6560]"
          )}
        >
          {isTextLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <MessageSquare className="h-5 w-5" />
          )}
        </button>
      </form>

      {/* Help Text */}
      <p className="mt-3 text-center text-xs text-[#a39e98]">
        {isTextMode
          ? "Voice mode available - click the button above to switch"
          : "Text input always available as backup"}
      </p>
    </div>
  );
}
