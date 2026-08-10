"use client";

import { BasicMarkdown } from "@/components/markdown/basic-markdown";

/**
 * Safe markdown renderer for admin dashboard LLM-generated content.
 *
 * Renders a deliberately small markdown subset without raw HTML or links,
 * ensuring no executable or navigation HTML reaches the DOM.
 */

export function SafeMarkdown({ content }: { content: string }) {
  return <BasicMarkdown content={content} />;
}
