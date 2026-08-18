// FE-M1: extracted from basic-markdown.tsx into its own module so
// `parseBlocks` can be spied on from tests (`vi.spyOn` intercepts a
// cross-module import binding, but not a call to a function from within the
// same file that defines it) — this lets a test assert that BasicMarkdown's
// `useMemo([content])` actually skips re-parsing, without shipping any
// test-only instrumentation in production code.

export type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "blockquote"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

export function parseBlocks(content: string): Block[] {
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
