"use client";

import { BasicMarkdown } from "@/components/markdown/basic-markdown";

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <BasicMarkdown
      content={content}
      allowLinks
      paragraphClassName="mb-2 last:mb-0"
      strongClassName="font-semibold"
      unorderedListClassName="list-disc list-inside mb-2 space-y-1"
      orderedListClassName="list-decimal list-inside mb-2 space-y-1"
    />
  );
}
