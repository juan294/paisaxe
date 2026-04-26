import type { SharedContextEntry } from "@/types/agents-dashboard";

/** Escape HTML entities to prevent XSS when rendering markdown with dangerouslySetInnerHTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Convert basic markdown (headings, bold, list items) to HTML. Input is escaped first for safety.
 *
 * @deprecated Use `<SafeMarkdown>` from `./safe-markdown` instead.
 * This function is kept for reference and its adversarial regression tests.
 */
export function renderMarkdown(md: string): string {
  const escaped = escapeHtml(md);
  return escaped
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n").map((line) => {
        // Headings → bold text
        if (/^#{1,3}\s+/.test(line)) {
          const text = line.replace(/^#{1,3}\s+/, "");
          return `<strong class="text-[#2d2a26] dark:text-[#f5f3ee]">${text}</strong>`;
        }
        // List items → bullet
        if (/^[-*]\s+/.test(line)) {
          const text = line.replace(/^[-*]\s+/, "");
          return `<li>${text}</li>`;
        }
        return line;
      });

      // Wrap consecutive <li> items in <ul>
      const html = lines.join("\n")
        .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="list-disc pl-4 space-y-0.5">$1</ul>');

      return `<div>${html}</div>`;
    })
    .join("")
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[#2d2a26] dark:text-[#f5f3ee]">$1</strong>');
}

/**
 * Deduplicate shared context entries by agent name, keeping only the most recent per agent.
 */
export function deduplicateByAgent(entries: SharedContextEntry[]): SharedContextEntry[] {
  const seen = new Map<string, SharedContextEntry>();
  for (const entry of entries) {
    const existing = seen.get(entry.agentName);
    if (!existing || entry.timestamp > existing.timestamp) {
      seen.set(entry.agentName, entry);
    }
  }
  return [...seen.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
