import "server-only";
import { SearchResultCache } from "./embedding-cache";
import { search } from "./search";
import { createChildAbortController, withChatStreamStageTiming } from "./chat-stream-timeouts";
import type { SearchResult } from "@/types";

const resultCache = new SearchResultCache();

/** Complete result hits skip the embedding provider as well as search and rerank. */
export async function retrieveChatContext(
  query: string,
  limit: number = 3,
  options: { signal?: AbortSignal } = {}
): Promise<SearchResult> {
  const child = createChildAbortController(options.signal);
  const signal = child.controller.signal;
  try {
    signal.throwIfAborted();
    // Query preparation keeps its existing 12s budget, including the cache read.
    // A hit needs no embedding; a miss still records one embedding stage.
    const prepared = await withChatStreamStageTiming("embedding", (async () => {
      const cached = await resultCache.get(query, limit);
      signal.throwIfAborted();
      if (cached) return { cached };
      const { generateEmbedding } = await import("./embeddings");
      signal.throwIfAborted();
      return { embedding: await generateEmbedding(query, { signal }) };
    })(), child.controller);
    signal.throwIfAborted();
    if (prepared.cached) return prepared.cached;
    return await withChatStreamStageTiming("search", search(prepared.embedding!, limit, query, {
      signal, skipCacheRead: true,
    }), child.controller);
  } finally {
    child.dispose();
  }
}
