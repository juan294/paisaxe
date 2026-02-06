import { describe, it, expect } from "vitest";
import { escapeHtml, renderMarkdown } from "./agents-dashboard";

describe("escapeHtml", () => {
  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('a "quoted" word')).toBe("a &quot;quoted&quot; word");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("renderMarkdown", () => {
  it("converts headings to bold", () => {
    const result = renderMarkdown("## My Heading");
    expect(result).toContain("<strong");
    expect(result).toContain("My Heading");
  });

  it("converts list items to <li> wrapped in <ul>", () => {
    const result = renderMarkdown("- item one\n- item two");
    expect(result).toContain("<li>");
    expect(result).toContain("<ul");
    expect(result).toContain("item one");
    expect(result).toContain("item two");
  });

  it("converts bold markdown to <strong>", () => {
    const result = renderMarkdown("this is **bold** text");
    expect(result).toContain("<strong");
    expect(result).toContain("bold");
  });

  it("escapes HTML tags in content to prevent XSS", () => {
    const result = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });

  it("escapes script tags in content", () => {
    const result = renderMarkdown("<script>alert('xss')</script>");
    expect(result).not.toContain("<script");
    expect(result).toContain("&lt;script&gt;");
  });

  it("escapes HTML inside markdown headings", () => {
    const result = renderMarkdown('## <b onmouseover="alert(1)">title</b>');
    expect(result).not.toContain('<b onmouseover');
    expect(result).toContain("&lt;b");
  });

  it("escapes HTML inside list items", () => {
    const result = renderMarkdown('- <a href="javascript:void(0)">click</a>');
    expect(result).not.toContain('<a href');
    expect(result).toContain("&lt;a");
  });

  it("handles combined markdown and HTML injection", () => {
    const input = '## Title\n\n- Item 1\n- <img src=x onerror=alert(1)>\n\n**bold <script>xss</script>**';
    const result = renderMarkdown(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;script&gt;");
    expect(result).toContain("&lt;img");
  });
});
