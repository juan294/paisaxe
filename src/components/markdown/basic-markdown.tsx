"use client";

import type { ElementType, ReactNode } from "react";

type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "blockquote"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

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

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: Extract<Block, { type: "unordered-list" | "ordered-list" }> | null = null;

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraph = [];
  };

  const flushList = () => {
    if (list && list.items.length > 0) blocks.push(list);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3 | 4, text: heading[2] });
      continue;
    }

    const blockquote = line.match(/^>\s+(.+)$/);
    if (blockquote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "blockquote", text: blockquote[1] });
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (list?.type !== "unordered-list") {
        flushList();
        list = { type: "unordered-list", items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (list?.type !== "ordered-list") {
        flushList();
        list = { type: "ordered-list", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function renderList(
  block: Extract<Block, { type: "unordered-list" | "ordered-list" }>,
  index: number,
  options: MarkdownOptions
) {
  const ListTag = block.type === "unordered-list" ? "ul" : "ol";
  const className = block.type === "unordered-list"
    ? options.unorderedListClassName
    : options.orderedListClassName;

  return (
    <ListTag key={index} className={className}>
      {block.items.map((item, itemIndex) => (
        <li key={itemIndex}>{parseInline(item, `${index}-${itemIndex}`, options)}</li>
      ))}
    </ListTag>
  );
}

export function BasicMarkdown({
  content,
  allowLinks = false,
  paragraphClassName,
  strongClassName,
  unorderedListClassName,
  orderedListClassName,
}: BasicMarkdownProps) {
  const blocks = parseBlocks(content);
  const options = {
    allowLinks,
    orderedListClassName,
    strongClassName,
    unorderedListClassName,
  };

  return (
    <>
      {blocks.map((block, index) => {
        if (block.type !== "paragraph" && block.type !== "heading" && block.type !== "blockquote") {
          return renderList(block, index, options);
        }

        if (block.type === "heading") {
          const HeadingTag = `h${block.level}` as ElementType;
          return (
            <HeadingTag key={index}>
              {parseInline(block.text, `${index}`, options)}
            </HeadingTag>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote key={index}>
              {parseInline(block.text, `${index}`, options)}
            </blockquote>
          );
        }

        return (
          <p key={index} className={paragraphClassName}>
            {parseInline(block.text, `${index}`, options)}
          </p>
        );
      })}
    </>
  );
}
