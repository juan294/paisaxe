import "server-only";
import { VoyageAIClient } from "voyageai";
import type { Chunk } from "@/types";

const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY,
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
  if (chunks.length === 0) {
    return [];
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
      console.info(
        `[Voyage AI] rerank: ${result.usage.totalTokens} tokens for ${chunks.length} chunks`
      );
    }

    if (!result.data) {
      console.error("[Voyage AI] Rerank returned no data, falling back to original order");
      return chunks.slice(0, topK);
    }

    // Reorder chunks based on reranker scores
    const reranked = result.data
      .filter((item) => item.index !== undefined)
      .map((item) => chunks[item.index!]);

    return reranked;
  } catch (error) {
    console.error("[Voyage AI] Rerank failed, falling back to original order:", error);
    return chunks.slice(0, topK);
  }
}
