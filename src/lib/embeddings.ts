import "server-only";
import { VoyageAIClient } from "voyageai";
import { EmbeddingCache } from "./embedding-cache";
import { logger } from "./logger";

const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY?.trim(),
});

const EMBEDDING_MODEL = "voyage-3.5";
// The corpus in production (all chunks, seeded 2026-01-27) is embedded with
// voyage-context-3 through the contextualized endpoint, so every vector that is
// compared against it - documents at ingest AND queries at search time - must use
// that same model and endpoint. Plain voyage-3.5 vectors live in a different space
// (cosine ~0.05 against the corpus), which made match_chunks return nothing and
// every chat answer ship with zero sources.
const CONTEXTUALIZED_MODEL = "voyage-context-3";
const EMBEDDING_DIMENSIONS = 512;
const MAX_BATCH_SIZE = 128;

// The cache key is derived from this id: it must differ from the old plain voyage-3.5
// entries (wrong-space vectors, cached for 24h) so none of them can be served again.
const embeddingCache = new EmbeddingCache(`${CONTEXTUALIZED_MODEL}:query`, EMBEDDING_DIMENSIONS);

interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
}

/**
 * Generate embedding for a single text using Voyage AI.
 * Used at query time. Embeds the query through the contextualized endpoint with
 * voyage-context-3 (inputs: [[query]]), the same model and endpoint that produced the
 * stored document embeddings, to ensure compatible vector spaces.
 *
 * BE-M4 (#785): accepts an optional `signal` so a caller-driven stage
 * timeout (see chat-stream-timeouts.ts's `abortController.abort()`) can
 * actually cancel the in-flight Voyage request instead of leaving it
 * running — and billing — after the caller has moved on.
 */
export async function generateEmbedding(
  text: string,
  options: { signal?: AbortSignal } = {}
): Promise<number[]> {
  // Check cache first
  const cached = await embeddingCache.get(text);
  if (cached) {
    return cached;
  }

  const result = await voyageClient.contextualizedEmbed(
    {
      inputs: [[text]],
      model: CONTEXTUALIZED_MODEL,
      inputType: "query",
      outputDimension: EMBEDDING_DIMENSIONS,
    },
    { abortSignal: options.signal }
  );

  const embedding = result.results?.[0]?.embeddings?.[0] as number[] | undefined;
  if (!embedding) {
    throw new Error("No embedding returned from Voyage AI");
  }

  // Log token usage
  if (result.totalTokens) {
    logger.debug("[Voyage AI] generateEmbedding", {
      total_tokens: result.totalTokens,
    });
  }

  // Cache the result
  await embeddingCache.set(text, embedding);

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batches.
 * Each text is embedded independently (no cross-chunk context).
 */
export async function generateEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  // Process in batches
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);

    const result = await voyageClient.embed({
      input: batch,
      model: EMBEDDING_MODEL,
      inputType: "document",
      outputDimension: EMBEDDING_DIMENSIONS,
    });

    if (!result.data) {
      throw new Error(`No embeddings returned for batch ${i}`);
    }

    allEmbeddings.push(...result.data.map((d) => d.embedding).filter((e): e is number[] => e !== undefined));
    const batchTokens = result.usage?.totalTokens || 0;
    totalTokens += batchTokens;

    // Log token usage per batch
    if (batchTokens) {
      logger.debug("[Voyage AI] generateEmbeddings batch", {
        batch: i,
        batch_tokens: batchTokens,
      });
    }
  }

  logger.debug("[Voyage AI] generateEmbeddings total", {
    total_tokens: totalTokens,
    text_count: texts.length,
  });
  return { embeddings: allEmbeddings, totalTokens };
}

/**
 * Generate contextualized embeddings for groups of chunks.
 *
 * Each group is a list of chunks from the same document (PDF). The
 * voyage-3 model embeds each chunk with awareness of its sibling
 * chunks, significantly improving retrieval quality for split documents.
 *
 * @param chunkGroups - Array of chunk groups. Each group is an array of text
 *   strings from the same source document.
 * @returns Flattened embeddings for all chunks across all groups, in order,
 *   plus total token usage.
 */
export async function generateContextualizedEmbeddings(
  chunkGroups: string[][]
): Promise<BatchEmbeddingResult> {
  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  for (let i = 0; i < chunkGroups.length; i++) {
    const group = chunkGroups[i];
    if (group.length === 0) continue;

    const result = await voyageClient.contextualizedEmbed({
      inputs: [group],
      model: CONTEXTUALIZED_MODEL,
      inputType: "document",
      outputDimension: EMBEDDING_DIMENSIONS,
    });

    // voyageai 0.4.x ExtendedClient returns { results: [{ embeddings: number[][] }], totalTokens }
    if (!result.results || result.results.length === 0) {
      throw new Error(`No contextualized embeddings returned for group ${i}`);
    }

    // results[0] is the document; results[0].embeddings[] are per-chunk vectors
    const documentResult = result.results[0];
    if (!documentResult.embeddings) {
      throw new Error(`No chunk embeddings in contextualized response for group ${i}`);
    }

    const groupEmbeddings = documentResult.embeddings.filter(
      (e): e is number[] => e !== undefined
    );

    allEmbeddings.push(...groupEmbeddings);

    const groupTokens = result.totalTokens || 0;
    totalTokens += groupTokens;

    if (groupTokens) {
      logger.debug("[Voyage AI] contextualizedEmbed group", {
        group: i,
        chunks: group.length,
        group_tokens: groupTokens,
      });
    }
  }

  logger.debug("[Voyage AI] generateContextualizedEmbeddings total", {
    total_tokens: totalTokens,
    group_count: chunkGroups.length,
  });
  return { embeddings: allEmbeddings, totalTokens };
}

/**
 * Get the embedding dimension size for the current model
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}
