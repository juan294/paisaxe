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
  topK: number = DEFAULT_TOP_K
): Promise<Chunk[]> {
  if (chunks.length <= topK) {
    return chunks;
  }

  try {
    const result = await voyageClient.rerank({
      query,
      documents: chunks.map((c) => c.content),
      model: RERANK_MODEL,
      topK,
    });

    // Log token usage
    if (result.usage?.totalTokens) {
      logger.debug("[Voyage AI] rerank", {
        total_tokens: result.usage.totalTokens,
        chunk_count: chunks.length,
      });
    }

    if (!result.data) {
      logger.error("[Voyage AI] Rerank returned no data, falling back to original order");
      return chunks.slice(0, topK);
    }

    // Reorder chunks based on reranker scores
    const reranked = result.data
      .filter((item) => item.index !== undefined)
      .map((item) => chunks[item.index!]);

    return reranked;
  } catch (error) {
    logger.error("[Voyage AI] Rerank failed, falling back to original order", {
      error: error instanceof Error ? error.message : String(error),
    });
    return chunks.slice(0, topK);
  }
}
