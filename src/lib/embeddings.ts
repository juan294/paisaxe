import "server-only";
import { VoyageAIClient } from "voyageai";
import { EmbeddingCache } from "./embedding-cache";

const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY,
});

const EMBEDDING_MODEL = "voyage-3";
const EMBEDDING_DIMENSIONS = 1024;
const MAX_BATCH_SIZE = 128;

const embeddingCache = new EmbeddingCache();

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
}

/**
 * Generate embedding for a single text using Voyage AI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cached = embeddingCache.get(text);
  if (cached) {
    return cached;
  }

  const result = await voyageClient.embed({
    input: [text],
    model: EMBEDDING_MODEL,
    inputType: "query",
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
  embeddingCache.set(text, embedding);

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batches
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
 * Get the embedding dimension size for the current model
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}
