import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { BasicMarkdown, __resetParseBlocksCallCountForTests } from "./basic-markdown";
import * as BasicMarkdownModule from "./basic-markdown";

describe("BasicMarkdown", () => {
  it("renders blockquotes as <blockquote> elements", () => {
    const { container } = render(<BasicMarkdown content={"> A wise quote"} />);

    const quote = container.querySelector("blockquote");
    expect(quote).toBeInTheDocument();
    expect(quote?.textContent).toBe("A wise quote");
  });

  it("renders headings, paragraphs and blockquotes together", () => {
    const { container } = render(
      <BasicMarkdown content={"# Title\n\nIntro paragraph.\n\n> Quoted line"} />
    );

    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("p")?.textContent).toBe("Intro paragraph.");
    expect(container.querySelector("blockquote")?.textContent).toBe("Quoted line");
  });

  it("treats an unterminated inline code span as plain text", () => {
    const { container } = render(<BasicMarkdown content={"Here is `unterminated code"} />);

    expect(container.querySelector("code")).not.toBeInTheDocument();
    expect(screen.getByText(/`unterminated code/)).toBeInTheDocument();
  });

  it("treats an unterminated bold span as plain text", () => {
    const { container } = render(<BasicMarkdown content={"Here is **unterminated bold"} />);

    expect(container.querySelector("strong")).not.toBeInTheDocument();
    expect(screen.getByText(/\*\*unterminated bold/)).toBeInTheDocument();
  });

  it("treats an unterminated italic asterisk as a literal character", () => {
    const { container } = render(<BasicMarkdown content={"5 * 3 equals 15"} />);

    expect(container.querySelector("em")).not.toBeInTheDocument();
    expect(screen.getByText(/5 \* 3 equals 15/)).toBeInTheDocument();
  });

  it("treats a stray opening bracket without a link target as text", () => {
    render(<BasicMarkdown content={"An array index like a[0] stays literal"} allowLinks />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/a\[0\] stays literal/)).toBeInTheDocument();
  });

  it("treats a link with an unterminated href as plain text", () => {
    render(<BasicMarkdown content={"See [Paisaxe](https://paisaxe.es"} allowLinks />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/\[Paisaxe\]\(https:\/\/paisaxe\.es/)).toBeInTheDocument();
  });

  it("renders a link whose href contains balanced nested parentheses", () => {
    render(
      <BasicMarkdown
        content={"Read [wiki](https://example.com/page_(disambiguation)) now."}
        allowLinks
      />
    );

    const link = screen.getByRole("link", { name: "wiki" });
    expect(link).toHaveAttribute("href", "https://example.com/page_(disambiguation)");
  });

  it("renders an href that fails URL parsing as plain text", () => {
    render(<BasicMarkdown content={"Broken [x](http://[) link"} allowLinks />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/x/)).toBeInTheDocument();
  });

  it("renders links as plain text when allowLinks is disabled", () => {
    render(<BasicMarkdown content={"No [link](https://paisaxe.es) here"} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/link/)).toBeInTheDocument();
  });

  it("falls back to the href text when a link has an empty label", () => {
    render(<BasicMarkdown content={"Bare [](https://paisaxe.es/visit) link"} allowLinks />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/https:\/\/paisaxe\.es\/visit/)).toBeInTheDocument();
  });

  describe("FE-M1: parseBlocks memoization", () => {
    beforeEach(() => {
      __resetParseBlocksCallCountForTests();
    });

    it("does not re-parse content on re-render when `content` is unchanged", () => {
      const { rerender } = render(<BasicMarkdown content="Hello world" />);
      expect(BasicMarkdownModule.__parseBlocksCallCountForTests).toBe(1);

      // Re-render with an unrelated prop change but the SAME content string —
      // without useMemo([content]), parseBlocks would run again here.
      rerender(<BasicMarkdown content="Hello world" allowLinks />);
      expect(BasicMarkdownModule.__parseBlocksCallCountForTests).toBe(1);

      rerender(<BasicMarkdown content="Hello world" allowLinks paragraphClassName="x" />);
      expect(BasicMarkdownModule.__parseBlocksCallCountForTests).toBe(1);
    });

    it("re-parses when `content` actually changes (e.g. a new streamed token)", () => {
      const { rerender } = render(<BasicMarkdown content="Hello" />);
      expect(BasicMarkdownModule.__parseBlocksCallCountForTests).toBe(1);

      rerender(<BasicMarkdown content="Hello world" />);
      expect(BasicMarkdownModule.__parseBlocksCallCountForTests).toBe(2);

      rerender(<BasicMarkdown content="Hello world!" />);
      expect(BasicMarkdownModule.__parseBlocksCallCountForTests).toBe(3);
    });
  });

  describe("FE-M1: block keys are content-derived, not index-based", () => {
    it("keeps a frozen block's DOM node stable when a new block boundary appears mid-stream", () => {
      // Simulates streaming: first render has a single paragraph; the next
      // token completes a heading marker, splitting the accumulated text
      // into two blocks. The paragraph's key must be derived from its own
      // content, not from its (now-shifted) position, so React reuses the
      // same <p> node instead of remounting it.
      const { container, rerender } = render(
        <BasicMarkdown content={"Intro paragraph"} />
      );
      const firstP = container.querySelector("p");
      expect(firstP).not.toBeNull();
      firstP!.setAttribute("data-marker", "kept");

      rerender(<BasicMarkdown content={"Intro paragraph\n\n# New Heading"} />);

      const pAfter = container.querySelector("p");
      expect(pAfter?.getAttribute("data-marker")).toBe("kept");
      expect(container.querySelector("h1")?.textContent).toBe("New Heading");
    });

    it("renders duplicate-content blocks without a duplicate-key warning", () => {
      const { container } = render(
        <BasicMarkdown content={"Yes.\n\nYes.\n\nYes."} />
      );
      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs).toHaveLength(3);
      paragraphs.forEach((p) => expect(p.textContent).toBe("Yes."));
    });
  });
});
