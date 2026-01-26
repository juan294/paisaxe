"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Story } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { Mic, MicOff, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrivacyNotice } from "./privacy-notice";

interface VoiceChatProps {
  story: Story;
  open: boolean;
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function VoiceChat({ story, open, onClose }: VoiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "es-ES";

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const handlePrivacyDismiss = useCallback(() => {
    setPrivacyAcknowledged(true);
    localStorage.setItem("paisaxe-privacy-acknowledged", "true");
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          context: `El usuario está viendo una imagen de: ${story.title} (${story.subtitle}). ${story.description}. Fuente: ${story.sourcePdf}.`,
        }),
      });

      if (!response.ok) throw new Error("Failed");

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message || "Lo siento, no pude procesar tu pregunta.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Lo siento, hubo un error. Intenta de nuevo.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 md:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Chat panel */}
      <div className="relative w-full max-w-lg bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h3 className="font-semibold text-white">{story.title}</h3>
            <p className="text-sm text-white/60">{story.subtitle}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Privacy Notice */}
        {!privacyAcknowledged && (
          <PrivacyNotice onDismiss={handlePrivacyDismiss} />
        )}

        {/* Messages */}
        <div className="h-64 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-white/50 py-8">
              <p className="mb-2">Pregunta lo que quieras sobre este lugar</p>
              {speechSupported && (
                <p className="text-sm">Puedes usar el micrófono para hablar</p>
              )}
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
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Pensando...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-white/10 flex gap-2"
        >
          {speechSupported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleListening}
              className={cn(
                "text-white hover:bg-white/10",
                isListening && "bg-red-500/50 hover:bg-red-500/60"
              )}
            >
              {isListening ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isListening ? "Escuchando..." : "Escribe tu pregunta..."}
            disabled={isLoading || isListening}
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
          />
          <Button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-white text-gray-900 hover:bg-white/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// Add type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}
