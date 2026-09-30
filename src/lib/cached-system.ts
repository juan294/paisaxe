import type Anthropic from "@anthropic-ai/sdk";

export type SystemBlock = Anthropic.TextBlockParam;

/**
 * Build Messages API `system` blocks for prompt caching.
 *
 * The stable text carries the only explicit `cache_control` marker. Volatile
 * text (message index, per-request flags, live DB context) goes in an unmarked
 * block after it, so it never changes the cached prefix. Blocks are
 * concatenated as-is, so the volatile block starts with a blank line to keep
 * its heading on its own line. See .claude/rules/prompt-caching.md.
 */
export function buildSystemBlocks(stable: string, volatile?: string): SystemBlock[] {
  const blocks: SystemBlock[] = [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
  ];
  if (volatile) {
    blocks.push({ type: "text", text: `\n\n${volatile}` });
  }
  return blocks;
}
