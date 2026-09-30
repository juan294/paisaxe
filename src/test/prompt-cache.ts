/**
 * Zero-spend prompt-caching oracle shared by the request-builder tests.
 * See .claude/rules/prompt-caching.md.
 *
 * Token counts are estimated from characters, never measured with a network
 * call. CHARS_PER_TOKEN is deliberately generous: platform.claude.com/docs
 * pricing FAQ gives ~4 characters per token for English, and the tokenizer
 * used by Claude 4.7+ models (Sonnet 5 included) produces ~30% more tokens for
 * the same text. Dividing by 4 therefore under-counts tokens, so a prefix that
 * clears the minimum here clears it for real. Retrieved 2026-09-30.
 */
export const CHARS_PER_TOKEN = 4;

/** Required headroom above the model minimum. */
export const CACHE_MIN_SAFETY_MARGIN = 1.2;

/** Minimum cacheable prefix for claude-sonnet-5 (docs prompt-caching table, 2026-09-30). */
export const SONNET_5_MIN_CACHE_TOKENS = 1024;

/** Hard API limit: explicit markers plus the top-level automatic one. */
export const MAX_CACHE_BREAKPOINTS = 4;

export function estimateTokens(text: string): number {
  return Math.floor(text.length / CHARS_PER_TOKEN);
}

interface BlockLike {
  cache_control?: unknown;
}

interface RequestLike {
  cache_control?: unknown;
  system?: string | BlockLike[];
  messages?: Array<{ content: string | BlockLike[] }>;
}

/** Count explicit `cache_control` markers plus the top-level automatic one. */
export function countCacheBreakpoints(request: RequestLike): number {
  const marked = (blocks: string | BlockLike[] | undefined) =>
    Array.isArray(blocks) ? blocks.filter((b) => b.cache_control != null).length : 0;

  return (
    (request.cache_control != null ? 1 : 0) +
    marked(request.system) +
    (request.messages ?? []).reduce((sum, m) => sum + marked(m.content), 0)
  );
}
