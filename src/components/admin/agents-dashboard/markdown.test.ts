import { describe, it, expect } from "vitest";
import { escapeHtml, renderMarkdown, deduplicateByAgent } from "./markdown";
import type { SharedContextEntry } from "@/types/agents-dashboard";

describe("agents-dashboard/markdown", () => {
  describe("escapeHtml", () => {
    it("escapes ampersands", () => {
      expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
    });

    it("escapes less-than signs", () => {
      expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    });

    it("escapes greater-than signs", () => {
      expect(escapeHtml("a > b")).toBe("a &gt; b");
    });

    it("escapes double quotes", () => {
      expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
    });

    it("escapes single quotes", () => {
      expect(escapeHtml("it's")).toBe("it&#039;s");
    });

    it("escapes multiple special characters in one string", () => {
      expect(escapeHtml('<a href="x">&</a>')).toBe(
        "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;"
      );
    });

    it("returns empty string for empty input", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("returns plain text unchanged", () => {
      expect(escapeHtml("hello world")).toBe("hello world");
    });

    it("handles strings with only special characters", () => {
      expect(escapeHtml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&#039;");
    });
  });

  describe("renderMarkdown", () => {
    it("wraps plain text in a div", () => {
      const result = renderMarkdown("Hello world");
      expect(result).toBe("<div>Hello world</div>");
    });

    it("converts h1 headings to bold", () => {
      const result = renderMarkdown("# Title");
      expect(result).toContain("<strong");
      expect(result).toContain("Title</strong>");
    });

    it("converts h2 headings to bold", () => {
      const result = renderMarkdown("## Subtitle");
      expect(result).toContain("<strong");
      expect(result).toContain("Subtitle</strong>");
    });

    it("converts h3 headings to bold", () => {
      const result = renderMarkdown("### Section");
      expect(result).toContain("<strong");
      expect(result).toContain("Section</strong>");
    });

    it("converts dash list items to <li>", () => {
      const result = renderMarkdown("- item one");
      expect(result).toContain("<li>item one</li>");
    });

    it("converts asterisk list items to <li>", () => {
      const result = renderMarkdown("* item two");
      expect(result).toContain("<li>item two</li>");
    });

    it("wraps consecutive <li> items in <ul>", () => {
      const result = renderMarkdown("- one\n- two\n- three");
      expect(result).toContain("<ul");
      expect(result).toContain("<li>one</li>");
      expect(result).toContain("<li>two</li>");
      expect(result).toContain("<li>three</li>");
      expect(result).toContain("</ul>");
    });

    it("converts **bold** syntax to <strong>", () => {
      const result = renderMarkdown("This is **bold** text");
      expect(result).toContain("<strong");
      expect(result).toContain("bold</strong>");
    });

    it("splits paragraphs on double newlines", () => {
      const result = renderMarkdown("First paragraph\n\nSecond paragraph");
      expect(result).toContain("<div>First paragraph</div>");
      expect(result).toContain("<div>Second paragraph</div>");
    });

    it("escapes HTML before rendering", () => {
      const result = renderMarkdown("<script>alert('xss')</script>");
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("handles empty string", () => {
      const result = renderMarkdown("");
      expect(result).toBe("<div></div>");
    });

    it("handles heading with bold content", () => {
      const result = renderMarkdown("# **Important**");
      // Heading replaces the # prefix; **Important** bold syntax is applied
      expect(result).toContain("Important");
    });

    it("handles mixed content with headings, lists, and text", () => {
      const result = renderMarkdown("# Title\n- item 1\n- item 2\n\nSome text");
      expect(result).toContain("Title</strong>");
      expect(result).toContain("<li>item 1</li>");
      expect(result).toContain("<li>item 2</li>");
      expect(result).toContain("Some text");
    });

    it("applies correct CSS classes to headings", () => {
      const result = renderMarkdown("# Title");
      expect(result).toContain('class="text-[#2d2a26] dark:text-[#f5f3ee]"');
    });

    it("applies correct CSS classes to bold text", () => {
      const result = renderMarkdown("This is **bold**");
      expect(result).toContain('class="text-[#2d2a26] dark:text-[#f5f3ee]"');
    });

    it("applies correct CSS class to <ul>", () => {
      const result = renderMarkdown("- item");
      expect(result).toContain('class="list-disc pl-4 space-y-0.5"');
    });

    it("handles multiple bold segments", () => {
      const result = renderMarkdown("**one** and **two**");
      const matches = result.match(/<strong/g);
      expect(matches?.length).toBe(2);
    });

    it("preserves non-heading non-list lines", () => {
      const result = renderMarkdown("just a line");
      expect(result).toBe("<div>just a line</div>");
    });

    // Adversarial / regression tests — LLM output must never produce executable HTML
    it("does not emit <script> tag from bold-injection attempt", () => {
      const result = renderMarkdown("**</strong><script>alert(1)</script>");
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("</script>");
    });

    it("does not emit unescaped <img> tag from injection", () => {
      const result = renderMarkdown("<img src=x onerror=alert(1)>");
      // No unescaped <img — the angle bracket must be HTML-escaped
      expect(result).not.toContain("<img");
    });

    it("does not emit unescaped <a> tag with javascript: protocol", () => {
      // renderMarkdown does not produce <a> tags — link syntax passes through as text
      const result = renderMarkdown("[link](javascript:alert(1))");
      // Must not produce an actual anchor element
      expect(result).not.toContain('<a ');
      expect(result).not.toContain('<a>');
    });

    it("does not emit executable event handler attributes from crafted bold input", () => {
      const result = renderMarkdown('**x" onmouseover="alert(1)**');
      // Quotes must be HTML-escaped; no unescaped attribute syntax like: <tag onmouseover=
      // A real attribute would be: " onmouseover=" with a literal quote before it.
      // After escapeHtml the quotes become &quot; so the pattern " onmouseover= cannot form.
      expect(result).not.toContain('" onmouseover=');
    });

    it("does not emit raw HTML tags even from nested injection attempts", () => {
      const result = renderMarkdown("## <h1>injected</h1>");
      expect(result).not.toContain("<h1>");
    });
  });

  describe("deduplicateByAgent", () => {
    it("returns empty array for empty input", () => {
      expect(deduplicateByAgent([])).toEqual([]);
    });

    it("returns single entry unchanged", () => {
      const entries: SharedContextEntry[] = [
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "All good",
          timestamp: "2026-02-16T10:00:00Z",
        },
      ];
      const result = deduplicateByAgent(entries);
      expect(result).toHaveLength(1);
      expect(result[0].agentName).toBe("Coverage Agent");
    });

    it("keeps only the most recent entry per agent", () => {
      const entries: SharedContextEntry[] = [
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "Old report",
          timestamp: "2026-02-16T08:00:00Z",
        },
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "New report",
          timestamp: "2026-02-16T10:00:00Z",
        },
      ];
      const result = deduplicateByAgent(entries);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("New report");
    });

    it("keeps entries from different agents", () => {
      const entries: SharedContextEntry[] = [
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "Coverage report",
          timestamp: "2026-02-16T10:00:00Z",
        },
        {
          agentFlag: "security_agent_enabled",
          agentName: "Security Agent",
          content: "Security report",
          timestamp: "2026-02-16T09:00:00Z",
        },
      ];
      const result = deduplicateByAgent(entries);
      expect(result).toHaveLength(2);
    });

    it("sorts results by timestamp descending (most recent first)", () => {
      const entries: SharedContextEntry[] = [
        {
          agentFlag: "security_agent_enabled",
          agentName: "Security Agent",
          content: "Security report",
          timestamp: "2026-02-16T08:00:00Z",
        },
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "Coverage report",
          timestamp: "2026-02-16T10:00:00Z",
        },
      ];
      const result = deduplicateByAgent(entries);
      expect(result[0].agentName).toBe("Coverage Agent");
      expect(result[1].agentName).toBe("Security Agent");
    });

    it("handles multiple duplicates across multiple agents", () => {
      const entries: SharedContextEntry[] = [
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "v1",
          timestamp: "2026-02-16T06:00:00Z",
        },
        {
          agentFlag: "security_agent_enabled",
          agentName: "Security Agent",
          content: "v1",
          timestamp: "2026-02-16T07:00:00Z",
        },
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "v2",
          timestamp: "2026-02-16T08:00:00Z",
        },
        {
          agentFlag: "security_agent_enabled",
          agentName: "Security Agent",
          content: "v2",
          timestamp: "2026-02-16T09:00:00Z",
        },
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "v3",
          timestamp: "2026-02-16T10:00:00Z",
        },
      ];
      const result = deduplicateByAgent(entries);
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("v3"); // Coverage latest
      expect(result[1].content).toBe("v2"); // Security latest
    });

    it("deduplicates by agentName, not agentFlag", () => {
      const entries: SharedContextEntry[] = [
        {
          agentFlag: "flag_a",
          agentName: "Same Agent",
          content: "old",
          timestamp: "2026-02-16T08:00:00Z",
        },
        {
          agentFlag: "flag_b",
          agentName: "Same Agent",
          content: "new",
          timestamp: "2026-02-16T10:00:00Z",
        },
      ];
      const result = deduplicateByAgent(entries);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("new");
    });

    it("skips older duplicate when a newer entry was already seen (line 51 false branch)", () => {
      const entries: SharedContextEntry[] = [
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "newer report",
          timestamp: "2026-02-16T10:00:00Z",
        },
        {
          agentFlag: "coverage_agent_enabled",
          agentName: "Coverage Agent",
          content: "older report",
          timestamp: "2026-02-16T06:00:00Z",
        },
      ];
      const result = deduplicateByAgent(entries);
      expect(result).toHaveLength(1);
      // Should keep the newer entry, not replace with the older one
      expect(result[0].content).toBe("newer report");
    });
  });
});
