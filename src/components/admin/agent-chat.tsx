"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Mic, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingPlatform } from "@/types/marketing";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Agent {
  id: string;
  name: string;
  platform: MarketingPlatform;
  description: string;
  voice?: {
    style: string;
    tone: string;
  };
}

const AGENTS: Agent[] = [
  {
    id: "xander",
    name: "Xander",
    platform: "x",
    description: "X specialist - tweets, threads, engagement",
    voice: { style: "Conversational, quick-witted", tone: "Friendly and playful" },
  },
  {
    id: "iris",
    name: "Iris",
    platform: "instagram",
    description: "Instagram specialist - visuals, Reels, Stories",
    voice: { style: "Warm, descriptive", tone: "Inviting and inspiring" },
  },
  {
    id: "penny",
    name: "Penny",
    platform: "pinterest",
    description: "Pinterest specialist - SEO, evergreen content",
    voice: { style: "Helpful, organized", tone: "Informative and reliable" },
  },
  {
    id: "tiko",
    name: "Tiko",
    platform: "tiktok",
    description: "TikTok specialist - trends, hooks, authenticity",
    voice: { style: "Energetic, authentic", tone: "Enthusiastic" },
  },
];

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

export function AgentChat() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(AGENTS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/marketing/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          message: userMessage,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgentChange = (agent: Agent) => {
    setSelectedAgent(agent);
    setMessages([]); // Clear conversation when switching agents
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm dark:bg-[#252320]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
            Marketing Agents
          </h2>
          <p className="text-sm text-[#6b6560] dark:text-[#a39e98]">
            Chat with specialized platform experts
          </p>
        </div>

        {/* Voice Ready indicator */}
        {selectedAgent.voice && (
          <div className="flex items-center gap-2 rounded-full bg-[#f5f3ee] px-3 py-1.5 dark:bg-[#2d2a26]">
            <Mic className="h-3.5 w-3.5 text-[#6b6560] dark:text-[#a39e98]" />
            <span className="text-xs text-[#6b6560] dark:text-[#a39e98]">Voice Ready</span>
          </div>
        )}
      </div>

      {/* Agent Selector */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => handleAgentChange(agent)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
              selectedAgent.id === agent.id
                ? "bg-[#2d2a26] text-[#f5f3ee] dark:bg-[#f5f3ee] dark:text-[#2d2a26]"
                : "bg-[#f5f3ee] text-[#6b6560] hover:bg-[#e5e3de] dark:bg-[#2d2a26] dark:text-[#a39e98] dark:hover:bg-[#3d3a36]"
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
          </button>
        ))}
      </div>

      {/* Agent Description */}
      <div className="mb-4 rounded-xl bg-[#f5f3ee] p-4 dark:bg-[#2d2a26]">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg text-white",
              PLATFORM_COLORS[selectedAgent.platform]
            )}
          >
            {PLATFORM_ICONS[selectedAgent.platform]}
          </div>
          <div>
            <p className="font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
              {selectedAgent.name}
            </p>
            <p className="text-sm text-[#6b6560] dark:text-[#a39e98]">
              {selectedAgent.description}
            </p>
            {selectedAgent.voice && (
              <p className="mt-1 text-xs text-[#a39e98]">
                Voice: {selectedAgent.voice.style}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="mb-4 h-[300px] overflow-y-auto rounded-xl bg-[#f5f3ee] p-4 dark:bg-[#1a1917]">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-[#a39e98]">
              Start a conversation with {selectedAgent.name}
              <br />
              <span className="text-xs">
                Ask for content ideas, captions, or strategy advice
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                    message.role === "user"
                      ? "bg-[#2d2a26] dark:bg-[#f5f3ee]"
                      : PLATFORM_COLORS[selectedAgent.platform]
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4 text-[#f5f3ee] dark:text-[#2d2a26]" />
                  ) : (
                    <span className="text-sm text-white">
                      {PLATFORM_ICONS[selectedAgent.platform]}
                    </span>
                  )}
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
            {isLoading && (
              <div className="flex gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                    PLATFORM_COLORS[selectedAgent.platform]
                  )}
                >
                  <span className="text-sm text-white">
                    {PLATFORM_ICONS[selectedAgent.platform]}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 dark:bg-[#252320]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#6b6560]" />
                  <span className="text-sm text-[#6b6560]">
                    {selectedAgent.name} is thinking...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask ${selectedAgent.name} for help...`}
          className="flex-1 rounded-xl border-0 bg-[#f5f3ee] px-4 py-3 text-sm text-[#2d2a26] placeholder-[#a39e98] focus:outline-none focus:ring-2 focus:ring-[#2d2a26]/20 dark:bg-[#2d2a26] dark:text-[#f5f3ee] dark:focus:ring-[#f5f3ee]/20"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl transition-all",
            input.trim() && !isLoading
              ? "bg-[#2d2a26] text-[#f5f3ee] hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
              : "bg-[#e5e3de] text-[#a39e98] dark:bg-[#2d2a26] dark:text-[#6b6560]"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
}
