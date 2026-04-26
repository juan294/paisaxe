import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SafeMarkdown } from "./safe-markdown";

describe("SafeMarkdown", () => {
  it("renders plain text content", () => {
    render(<SafeMarkdown content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders bold markdown syntax as <strong>", () => {
    const { container } = render(<SafeMarkdown content="**bold text**" />);
    expect(container.querySelector("strong")).toBeInTheDocument();
    expect(screen.getByText("bold text")).toBeInTheDocument();
  });

  it("renders italic markdown as <em>", () => {
    const { container } = render(<SafeMarkdown content="*italic text*" />);
    expect(container.querySelector("em")).toBeInTheDocument();
  });

  it("renders unordered list items", () => {
    const { container } = render(<SafeMarkdown content={"- item one\n- item two"} />);
    const lis = container.querySelectorAll("li");
    expect(lis).toHaveLength(2);
    expect(screen.getByText("item one")).toBeInTheDocument();
    expect(screen.getByText("item two")).toBeInTheDocument();
  });

  it("renders headings", () => {
    const { container } = render(<SafeMarkdown content="# Heading One" />);
    expect(container.querySelector("h1")).toBeInTheDocument();
    expect(screen.getByText("Heading One")).toBeInTheDocument();
  });

  it("renders inline code", () => {
    const { container } = render(<SafeMarkdown content="`some code`" />);
    expect(container.querySelector("code")).toBeInTheDocument();
  });

  // Adversarial tests — LLM-generated content must never produce executable HTML

  it("does not render <script> tags", () => {
    const { container } = render(
      <SafeMarkdown content="<script>alert('xss')</script>" />
    );
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("<script");
  });

  it("does not render <img> tags with onerror", () => {
    const { container } = render(
      <SafeMarkdown content="<img src=x onerror=alert(1)>" />
    );
    // No <img> element should exist in the DOM — this is the real security check
    expect(container.querySelector("img")).not.toBeInTheDocument();
    // No element should carry an onerror attribute
    expect(container.querySelector("[onerror]")).not.toBeInTheDocument();
  });

  it("does not render <a> tags with javascript: href", () => {
    const { container } = render(
      <SafeMarkdown content="[click me](javascript:alert(1))" />
    );
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("does not render disallowed elements like <iframe>", () => {
    const { container } = render(
      <SafeMarkdown content='<iframe src="https://evil.example"></iframe>' />
    );
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("does not add event handler attributes to any DOM element", () => {
    const { container } = render(
      <SafeMarkdown content='**x" onmouseover="alert(1)**' />
    );
    // The text content may contain "onmouseover" as a string, but no element must carry it as an attribute
    expect(container.querySelector("[onmouseover]")).not.toBeInTheDocument();
    // No script element should exist
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });

  it("handles empty string gracefully", () => {
    const { container } = render(<SafeMarkdown content="" />);
    // Should render without throwing; container may be empty or minimal
    expect(container).toBeDefined();
  });

  it("renders multi-paragraph content", () => {
    const md = "First paragraph.\n\nSecond paragraph.";
    render(<SafeMarkdown content={md} />);
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
  });
});
