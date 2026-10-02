"use client";

import { useMemo, type ElementType, type ReactNode } from "react";
import { parseBlocks, type Block } from "./parse-blocks";

interface BasicMarkdownProps {
  content: string;
  allowLinks?: boolean;
  paragraphClassName?: string;
  strongClassName?: string;
  unorderedListClassName?: string;
  orderedListClassName?: string;
}

type MarkdownOptions = Required<Pick<BasicMarkdownProps, "allowLinks">>
  & Pick<BasicMarkdownProps, "orderedListClassName" | "strongClassName" | "unorderedListClassName">;

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const URL_BASE = "https://paisaxe.es";

function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href, URL_BASE);
    return SAFE_LINK_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function findLinkHrefEnd(text: string, start: number): number {
  let depth = 0;

  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "(") {
      depth += 1;
      continue;
    }

    if (text[index] === ")") {
      if (depth === 0) return index;
      depth -= 1;
    }
  }

  return -1;
}

function findNextToken(text: string, cursor: number): number {
  const candidates = [
    text.indexOf("`", cursor),
    text.indexOf("**", cursor),
    text.indexOf("*", cursor),
    text.indexOf("[", cursor),
  ].filter((index) => index >= 0);

  return candidates.length > 0 ? Math.min(...candidates) : -1;
}

function parseInline(
  text: string,
  keyPrefix: string,
  options: MarkdownOptions
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let nodeIndex = 0;

  const pushText = (value: string) => {
    if (value) nodes.push(value);
  };

  while (cursor < text.length) {
    const next = findNextToken(text, cursor);

    if (next === -1) {
      pushText(text.slice(cursor));
      break;
    }

    pushText(text.slice(cursor, next));

    if (text[next] === "`") {
      const end = text.indexOf("`", next + 1);
      if (end === -1) {
        pushText(text.slice(next));
        break;
      }
      nodes.push(<code key={`${keyPrefix}-code-${nodeIndex++}`}>{text.slice(next + 1, end)}</code>);
      cursor = end + 1;
      continue;
    }

    if (text.startsWith("**", next)) {
      const end = text.indexOf("**", next + 2);
      if (end === -1) {
        pushText(text.slice(next));
        break;
      }
      nodes.push(
        <strong key={`${keyPrefix}-strong-${nodeIndex++}`} className={options.strongClassName}>
          {parseInline(text.slice(next + 2, end), `${keyPrefix}-strong-${nodeIndex}`, options)}
        </strong>
      );
      cursor = end + 2;
      continue;
    }

    if (text[next] === "*") {
      const end = text.indexOf("*", next + 1);
      if (end === -1) {
        pushText(text[next]);
        cursor = next + 1;
        continue;
      }
      nodes.push(
        <em key={`${keyPrefix}-em-${nodeIndex++}`}>
          {parseInline(text.slice(next + 1, end), `${keyPrefix}-em-${nodeIndex}`, options)}
        </em>
      );
      cursor = end + 1;
      continue;
    }

    const labelEnd = text.indexOf("](", next);
    if (labelEnd === -1) {
      pushText(text[next]);
      cursor = next + 1;
      continue;
    }

    const hrefEnd = findLinkHrefEnd(text, labelEnd + 2);
    if (hrefEnd === -1) {
      pushText(text.slice(next));
      break;
    }

    const label = text.slice(next + 1, labelEnd);
    const href = text.slice(labelEnd + 2, hrefEnd).trim();
    if (options.allowLinks && label && href && isSafeHref(href)) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${nodeIndex++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
        >
          {parseInline(label, `${keyPrefix}-link-${nodeIndex}`, options)}
        </a>
      );
    } else {
      pushText(label || href);
    }
    cursor = hrefEnd + 1;
  }

  return nodes;
}

function renderList(
  block: Extract<Block, { type: "unordered-list" | "ordered-list" }>,
  blockKey: string,
  index: number,
  options: MarkdownOptions
) {
  const ListTag = block.type === "unordered-list" ? "ul" : "ol";
  const className = block.type === "unordered-list"
    ? options.unorderedListClassName
    : options.orderedListClassName;

  return (
    <ListTag key={blockKey} className={className}>
      {block.items.map((item, itemIndex) => (
        <li key={itemIndex}>{parseInline(item, `${index}-${itemIndex}`, options)}</li>
      ))}
    </ListTag>
  );
}

// FE-M1: derives a React key from a block's own content rather than its
// array index. During streaming, `parseBlocks` re-tokenizes the whole
// accumulated string on every token; a block that has already finished
// growing keeps producing the same content (and therefore the same key)
// regardless of how many more blocks appear after it. Index-based keys, by
// contrast, only stay stable when block *count* never changes ahead of a
// given position — any mid-stream boundary shift (e.g. a run of plain text
// splitting into a paragraph + a list) shifts every following index and
// forces React to remount those subtrees even though their content didn't
// change.
function blockIdentity(block: Block): string {
  if (block.type === "unordered-list" || block.type === "ordered-list") {
    return `${block.type}:${block.items.join(" ")}`;
  }
  if (block.type === "heading") {
    return `heading-${block.level}:${block.text}`;
  }
  return `${block.type}:${block.text}`;
}

// Two blocks can legitimately share identical content (e.g. the model
// repeats a short line); disambiguate same-content blocks by occurrence
// order so keys stay unique without falling back to raw array index.
function computeBlockKeys(blocks: Block[]): string[] {
  const seen = new Map<string, number>();
  return blocks.map((block) => {
    const identity = blockIdentity(block);
    const occurrence = seen.get(identity) ?? 0;
    seen.set(identity, occurrence + 1);
    return occurrence === 0 ? identity : `${identity}#${occurrence}`;
  });
}

export function BasicMarkdown({
  content,
  allowLinks = false,
  paragraphClassName,
  strongClassName,
  unorderedListClassName,
  orderedListClassName,
}: BasicMarkdownProps) {
  // FE-M1: `parseBlocks` re-tokenizes the whole accumulated message string
  // (O(n) per call, O(n^2) over a streamed response's lifetime) — memoize on
  // `content` so a render triggered by an unrelated prop/parent update
  // doesn't re-parse text that hasn't changed.
  const blocks = useMemo(() => parseBlocks(content), [content]);
  const blockKeys = useMemo(() => computeBlockKeys(blocks), [blocks]);
  const options = {
    allowLinks,
    orderedListClassName,
    strongClassName,
    unorderedListClassName,
  };

  return (
    <>
      {blocks.map((block, index) => {
        const key = blockKeys[index];

        if (block.type !== "paragraph" && block.type !== "heading" && block.type !== "blockquote") {
          return renderList(block, key, index, options);
        }

        if (block.type === "heading") {
          const HeadingTag = `h${block.level}` as ElementType;
          return (
            <HeadingTag key={key}>
              {parseInline(block.text, `${index}`, options)}
            </HeadingTag>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote key={key}>
              {parseInline(block.text, `${index}`, options)}
            </blockquote>
          );
        }

        return (
          <p key={key} className={paragraphClassName}>
            {parseInline(block.text, `${index}`, options)}
          </p>
        );
      })}
    </>
  );
}
