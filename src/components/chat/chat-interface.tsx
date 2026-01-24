"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";
import { SuggestionChips } from "./suggestion-chips";
import type { Message, SuggestionChip } from "@/types";
import { generateId } from "@/lib/utils";

const SUGGESTIONS: SuggestionChip[] = [
  { label: "Fin de semana en Asturias", query: "Que puedo hacer en un fin de semana en Asturias?" },
  { label: "Rutas de senderismo", query: "Cuales son las mejores rutas de senderismo?" },
  { label: "Gastronomia tipica", query: "Que platos tipicos debo probar en Asturias?" },
  { label: "Playas bonitas", query: "Cuales son las playas mas bonitas de Asturias?" },
  { label: "Visitar Oviedo", query: "Que ver en Oviedo en un dia?" },
  { label: "Sidra asturiana", query: "Donde puedo tomar sidra y como se escancia?" },
];

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const data = await response.json();

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: data.message,
        sources: data.sources,
        images: data.images,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "Lo siento, ha ocurrido un error. Por favor, intenta de nuevo.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (query: string) => {
    sendMessage(query);
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-2xl shadow-lg border">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-6xl mb-4">🏔️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Bienvenido a tu guia de Asturias
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Preguntame lo que quieras sobre turismo en Asturias: rutas,
              gastronomia, playas, ciudades, cultura... Estoy aqui para ayudarte
              a planificar tu visita.
            </p>
            <SuggestionChips
              suggestions={SUGGESTIONS}
              onSelect={handleSuggestionClick}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Buscando informacion...</span>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4">
        {messages.length > 0 && messages.length < 4 && (
          <div className="mb-3">
            <SuggestionChips
              suggestions={SUGGESTIONS.slice(0, 3)}
              onSelect={handleSuggestionClick}
              compact
            />
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre Asturias..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
