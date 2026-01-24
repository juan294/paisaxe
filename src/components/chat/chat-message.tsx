"use client";

import ReactMarkdown from "react-markdown";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";
import { SourceCard } from "../results/source-card";
import { ImageGallery } from "../results/image-gallery";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          "flex flex-col gap-2 max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-secondary rounded-tl-sm"
          )}
        >
          <ReactMarkdown
            className="prose prose-sm max-w-none dark:prose-invert"
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => (
                <ul className="list-disc pl-4 mb-2">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-4 mb-2">{children}</ol>
              ),
              li: ({ children }) => <li className="mb-1">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {message.images && message.images.length > 0 && (
          <ImageGallery images={message.images} />
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.sources.slice(0, 3).map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
