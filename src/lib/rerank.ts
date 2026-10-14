import "server-only";
import { VoyageAIClient } from "voyageai";
import type { Chunk } from "@/types";
import { logger } from "./logger";

const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY?.trim(),
});

const RERANK_MODEL = "rerank-2.5";
const DEFAULT_TOP_K = 3;

/**
 * Rerank chunks using Voyage AI rerank-2.5 for improved relevance.
 *
 * Takes candidate chunks from vector search and reorders them by
 * query-specific relevance. Falls back to original order on failure.
 */
export async function rerankChunks(
  query: string,
  chunks: Chunk[],
  topK: number = DEFAULT_TOP_K,
  options: { signal?: AbortSignal; onDegraded?: () => void; timeoutMs?: number } = {}
): Promise<Chunk[]> {
  options.signal?.throwIfAborted();
  if (chunks.length <= topK) {
    return chunks;
  }

  try {
    const result = await voyageClient.rerank({
      query,
      documents: chunks.map((c) => c.content),
      model: RERANK_MODEL,
      topK,
    }, { abortSignal: options.signal, timeoutInSeconds: options.timeoutMs === undefined ? undefined : options.timeoutMs / 1000 });
    options.signal?.throwIfAborted();

    // Log token usage
    if (result.usage?.totalTokens) {
      logger.debug("[Voyage AI] rerank", {
        total_tokens: result.usage.totalTokens,
        chunk_count: chunks.length,
      });
    }

    if (!result.data) {
      logger.error("[Voyage AI] Rerank returned no data, falling back to original order");
      options.onDegraded?.();
      return chunks.slice(0, topK);
    }

    // Reorder chunks based on reranker scores
    const indices = result.data.map(item => item.index);
    if (indices.length === 0 || indices.some(index => index === undefined || !Number.isInteger(index) || index < 0 || index >= chunks.length)
      || new Set(indices).size !== indices.length) {
      options.onDegraded?.();
      logger.error("[Voyage AI] Rerank returned invalid indices, falling back to original order");
      return chunks.slice(0, topK);
    }
    const reranked: Chunk[] = [];
    for (const index of indices) {
      const chunk = index === undefined ? undefined : chunks[index];
      if (chunk === undefined) {
        options.onDegraded?.();
        logger.error("[Voyage AI] Rerank returned invalid indices, falling back to original order");
        return chunks.slice(0, topK);
      }
      reranked.push(chunk);
    }

    return reranked;
  } catch (error) {
    options.signal?.throwIfAborted();
    options.onDegraded?.();
    logger.error("[Voyage AI] Rerank failed, falling back to original order", {
      error: error instanceof Error ? error.message : String(error),
    });
    return chunks.slice(0, topK);
  }
}
