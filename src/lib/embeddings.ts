import "server-only";
import { VoyageAIClient } from "voyageai";
import { EmbeddingCache } from "./embedding-cache";

const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY?.trim(),
});

const EMBEDDING_MODEL = "voyage-3.5";
const CONTEXTUALIZED_MODEL = "voyage-3.5";
const EMBEDDING_DIMENSIONS = 512;
const MAX_BATCH_SIZE = 128;

const embeddingCache = new EmbeddingCache();

interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
}

/**
 * Generate embedding for a single text using Voyage AI.
 * Used at query time — uses the same model (voyage-3) as document
 * embeddings to ensure compatible vector spaces.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cached = await embeddingCache.get(text);
  if (cached) {
    return cached;
  }

  const result = await voyageClient.embed({
    input: [text],
    model: EMBEDDING_MODEL,
    inputType: "query",
    outputDimension: EMBEDDING_DIMENSIONS,
  });

  if (!result.data || result.data.length === 0 || !result.data[0].embedding) {
    throw new Error("No embedding returned from Voyage AI");
  }

  const embedding = result.data[0].embedding as number[];

  // Log token usage
  if (result.usage?.totalTokens) {
    console.info(`[Voyage AI] generateEmbedding: ${result.usage.totalTokens} tokens`);
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
      console.info(`[Voyage AI] generateEmbeddings batch ${i}: ${batchTokens} tokens`);
    }
  }

  console.info(`[Voyage AI] generateEmbeddings total: ${totalTokens} tokens for ${texts.length} texts`);
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

    if (!result.data || result.data.length === 0) {
      throw new Error(`No contextualized embeddings returned for group ${i}`);
    }

    // Response structure: data[0] is the document, data[0].data[] are per-chunk embeddings
    const documentData = result.data[0];
    if (!documentData.data) {
      throw new Error(`No chunk embeddings in contextualized response for group ${i}`);
    }

    const groupEmbeddings = documentData.data
      .map((item) => item.embedding)
      .filter((e): e is number[] => e !== undefined);

    allEmbeddings.push(...groupEmbeddings);

    const groupTokens = result.usage?.totalTokens || 0;
    totalTokens += groupTokens;

    if (groupTokens) {
      console.info(
        `[Voyage AI] contextualizedEmbed group ${i}: ${group.length} chunks, ${groupTokens} tokens`
      );
    }
  }

  console.info(
    `[Voyage AI] generateContextualizedEmbeddings total: ${totalTokens} tokens for ${chunkGroups.length} groups`
  );
  return { embeddings: allEmbeddings, totalTokens };
}

/**
 * Get the embedding dimension size for the current model
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}
