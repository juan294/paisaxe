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

// Platform letter badges for Swiss Minimal aesthetic
const PLATFORM_BADGES: Record<MarketingPlatform, string> = {
  x: "X",
  instagram: "IG",
  pinterest: "Pi",
  tiktok: "Tk",
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
    <div className="border border-stone-200 p-6 dark:border-stone-800">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-4 dark:border-stone-800">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
            {isTextMode ? "Text Mode" : "Voice Mode"}
          </p>
        </div>

        {/* Mode Toggle */}
        <button
          onClick={() => setIsTextMode(!isTextMode)}
          className="font-mono text-xs uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900 dark:hover:text-stone-100"
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
                ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                : "border-stone-200 text-stone-600 hover:border-stone-400 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500",
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
          <div className="flex items-center gap-6 border border-stone-200 p-6 dark:border-stone-800">
            {/* Agent Avatar */}
            <div className="relative">
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center border-2 font-mono text-xl font-medium transition-all",
                  isConnected
                    ? "border-stone-900 text-stone-900 dark:border-stone-100 dark:text-stone-100"
                    : "border-stone-300 text-stone-400",
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
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  {selectedAgent.name}
                </p>
                <p className="font-mono text-xs text-stone-400">
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
                        ? "border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white dark:border-stone-100 dark:text-stone-100 dark:hover:bg-stone-100 dark:hover:text-stone-900"
                        : "cursor-not-allowed border-stone-200 text-stone-300"
                    )}
                  >
                    <Phone className="h-3 w-3" />
                    Start Call
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleMute}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center border transition-all",
                        isMuted
                          ? "border-red-500 bg-red-500 text-white"
                          : "border-stone-200 text-stone-500 hover:border-stone-400 dark:border-stone-700"
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
      <div className="mb-4 h-[250px] overflow-y-auto border border-stone-200 p-4 dark:border-stone-800">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center font-mono text-xs text-stone-400">
              {isTextMode ? (
                <>
                  Start a conversation with {selectedAgent.name}
                  <br />
                  <span className="text-stone-300">Type your message below</span>
                </>
              ) : (
                <>
                  Click &quot;Start Call&quot; to begin
                  <br />
                  <span className="text-stone-300">Or switch to text mode</span>
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
                    "flex h-6 w-6 flex-shrink-0 items-center justify-center border font-mono text-[9px] font-medium",
                    message.role === "user"
                      ? "border-stone-900 text-stone-900 dark:border-stone-100 dark:text-stone-100"
                      : "border-stone-400 text-stone-500"
                  )}
                >
                  {message.role === "user" ? "U" : PLATFORM_BADGES[selectedAgent.platform]}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] border px-3 py-2 text-sm",
                    message.role === "user"
                      ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                      : "border-stone-200 text-stone-700 dark:border-stone-700 dark:text-stone-300"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isTextLoading && (
              <div className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center border border-stone-400 font-mono text-[9px] font-medium text-stone-500">
                  {PLATFORM_BADGES[selectedAgent.platform]}
                </div>
                <div className="flex items-center gap-2 border border-stone-200 px-3 py-2 dark:border-stone-700">
                  <Loader2 className="h-3 w-3 animate-spin text-stone-400" />
                  <span className="font-mono text-xs text-stone-400">Thinking...</span>
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
          className="flex-1 border border-stone-200 bg-transparent px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:text-stone-100"
          disabled={isTextLoading}
        />
        <button
          type="submit"
          disabled={!textInput.trim() || isTextLoading}
          className={cn(
            "flex h-12 w-12 items-center justify-center border transition-all",
            textInput.trim() && !isTextLoading
              ? "border-stone-900 bg-stone-900 text-white hover:bg-stone-800 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
              : "border-stone-200 text-stone-300 dark:border-stone-700"
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
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-stone-400">
        {isTextMode
          ? "Voice mode available above"
          : "Text input always available"}
      </p>
    </div>
  );
}
