"use client";

import ReactMarkdown from "react-markdown";

/**
 * Safe markdown renderer for admin dashboard LLM-generated content.
 *
 * Uses react-markdown with an explicit allowlist of safe HTML elements.
 * Disallowed elements (e.g. <script>, <img>, <a>) are unwrapped rather than
 * rendered, ensuring no executable or navigation HTML reaches the DOM.
 *
 * Replaces the hand-rolled `renderMarkdown` + `dangerouslySetInnerHTML` pattern.
 */

const ALLOWED_ELEMENTS: string[] = [
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "code",
  "pre",
  "blockquote",
  "br",
];

export function SafeMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown allowedElements={ALLOWED_ELEMENTS} unwrapDisallowed>
      {content}
    </ReactMarkdown>
  );
}
