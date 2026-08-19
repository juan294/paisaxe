import { supabase } from "./supabase";
import { rerankChunks } from "./rerank";
import { SearchResultCache } from "./embedding-cache";
import type { Chunk, ImageResult, SearchResult } from "@/types";
import { logger } from "@/lib/logger";

/** Number of candidates to retrieve from vector search before reranking */
const RERANK_CANDIDATE_COUNT = 10;
export const RERANK_TIMEOUT_MS = 2_500;

// PE-M2 (#810): caches the full retrieval result (vector search + rerank +
// image lookup) keyed on the normalized query text, so a repeat question
// skips all three round-trips, not just the embedding call.
const searchResultCache = new SearchResultCache();

export async function searchChunks(
  queryEmbedding: number[],
  limit: number = 5
): Promise<Chunk[]> {
  // The match_chunks RPC uses an HNSW index (migration 084).
  // hnsw.ef_search = 40 is set via SET LOCAL inside the SQL function body,
  // so no client-side session variable setup is needed here.
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,  // Lowered from 0.7 to get more results
    match_count: limit,
  });

  if (error) {
    throw new Error(`Search RPC failed: ${error.message ?? String(error)}`);
  }

  return data.map((row: {
    id: string;
    content: string;
    source_pdf: string;
    page_number: number | null;
    section_title: string | null;
    image_refs: string[] | null;
    similarity: number;
  }) => ({
    id: row.id,
    content: row.content,
    sourcePdf: row.source_pdf,
    pageNumber: row.page_number,
    sectionTitle: row.section_title,
    imageRefs: row.image_refs,
    similarity: row.similarity,
  }));
}

export async function getRelatedImages(
  imageRefs: string[]
): Promise<ImageResult[]> {
  if (imageRefs.length === 0) return [];

  const { data, error } = await supabase
    .from("images")
    .select("id, path, caption, source_pdf")
    .in("path", imageRefs);

  if (error) {
    logger.error("[TABLE_FALLBACK]", { table: "images", error: error.message ?? String(error) });
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    path: row.path,
    caption: row.caption,
    sourcePdf: row.source_pdf,
  }));
}

/**
 * Search for relevant content using vector search + reranking.
 *
 * When `queryText` is provided, the pipeline is:
 *   1. Vector search retrieves RERANK_CANDIDATE_COUNT candidates
 *   2. Voyage AI rerank-2.5 reorders by query relevance
 *   3. Top `limit` results are returned
 *
 * Without `queryText`, falls back to plain vector search with `limit`.
 */
export async function search(
  queryEmbedding: number[],
  limit: number = 5,
  queryText?: string
): Promise<SearchResult> {
  // PE-M2 (#810): a cache hit here skips the vector-search RPC, the rerank
  // call, AND the image lookup — not just the embedding (see embedding-cache.ts).
  // Only cached when queryText is provided; the plain-vector-search fallback
  // path below is not cached (see keying rationale there).
  if (queryText) {
    const cached = await searchResultCache.get(queryText, limit);
    if (cached) return cached;
  }

  // When reranking, widen the initial search to get more candidates
  const candidateCount = queryText ? RERANK_CANDIDATE_COUNT : limit;
  const candidates = await searchChunks(queryEmbedding, candidateCount);

  // PE-H3: fire getRelatedImages concurrently with rerankChunks.
  // getRelatedImages only needs the candidate list (not the reranked order),
  // so we can start it immediately using ALL candidate refs. After rerank
  // completes we filter the already-fetched images down to the top-k refs.
  if (!queryText) {
    const allImageRefs = candidates.flatMap((chunk) => chunk.imageRefs || []);
    const uniqueImageRefs = [...new Set(allImageRefs)];
    const images = await getRelatedImages(uniqueImageRefs);
    return { chunks: candidates, images };
  }

  const allCandidateRefs = candidates.flatMap((chunk) => chunk.imageRefs || []);
  const uniqueCandidateRefs = [...new Set(allCandidateRefs)];

  const rerankRace = withRerankTimeout(
    rerankChunks(queryText, candidates, limit),
    candidates,
    limit
  );

  // Start both in parallel — neither depends on the other's result yet.
  const [rerankedChunks, allImages] = await Promise.all([
    rerankRace.result,
    getRelatedImages(uniqueCandidateRefs),
  ]);

  // Filter images to only those referenced by the reranked top-k chunks.
  const topKRefs = new Set(rerankedChunks.flatMap((chunk) => chunk.imageRefs || []));
  const images = allImages.filter((img) => topKRefs.has(img.path));

  const result: SearchResult = { chunks: rerankedChunks, images };

  // Don't cache a rerank-timeout fallback: it's a degraded (vector-order-only)
  // result, and caching it would serve that degraded ranking to every repeat
  // query for the full TTL even after a transient rerank slowdown passes.
  if (!rerankRace.timedOut()) {
    void searchResultCache.set(queryText, limit, result);
  }

  return result;
}

function withRerankTimeout(
  rerankPromise: Promise<Chunk[]>,
  candidates: Chunk[],
  limit: number
): { result: Promise<Chunk[]>; timedOut: () => boolean } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeoutPromise = new Promise<Chunk[]>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      logger.warn("[SEARCH_RERANK_TIMEOUT]", { timeoutMs: RERANK_TIMEOUT_MS });
      resolve(candidates.slice(0, limit));
    }, RERANK_TIMEOUT_MS);
  });

  const result = Promise.race([rerankPromise, timeoutPromise]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });

  return { result, timedOut: () => timedOut };
}
