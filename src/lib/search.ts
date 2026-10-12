import { activeCorpusVersion } from "./active-corpus";
import { isAuthoredCitation } from "./corpus-citation";
import { parseImageProvenance, resolvePermittedImage } from "./image-provenance";
import { supabase } from "./supabase";
import { rerankChunks } from "./rerank";
import { SearchResultCache } from "./embedding-cache";
import { createChildAbortController } from "./chat-stream-timeouts";
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
  limit: number = 5,
  options: { signal?: AbortSignal; corpusVersion?: string } = {}
): Promise<Chunk[]> {
  options.signal?.throwIfAborted();
  const version = options.corpusVersion ?? await activeCorpusVersion(options.signal);
  const query = supabase.rpc("match_corpus_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: limit,
    corpus_version: version,
  });
  const { data, error } = await (options.signal ? query.abortSignal(options.signal) : query);
  options.signal?.throwIfAborted();

  if (error) {
    throw new Error(`Search RPC failed: ${error.message ?? String(error)}`);
  }

  return data.map((row: {
    id: string;
    content: string;
    source_pdf?: string;
    citation?: unknown;
    page_number: number | null;
    section_title: string | null;
    image_refs: string[] | null;
    similarity: number;
  }) => {
    const citation = isAuthoredCitation(row.citation) ? row.citation : undefined;
    if (version !== "legacy" && !citation) throw new Error("Invalid authored citation");
    return {
    id: row.id,
    content: row.content,
    sourcePdf: row.source_pdf,
    ...(citation ? { citation } : {}),
    pageNumber: row.page_number,
    sectionTitle: row.section_title,
    imageRefs: row.image_refs,
    similarity: row.similarity,
  };
  });
}

export async function getRelatedImages(
  imageRefs: string[],
  options: { signal?: AbortSignal; onDegraded?: () => void; corpusVersion?: string } = {}
): Promise<ImageResult[]> {
  options.signal?.throwIfAborted();
  const version = options.corpusVersion ?? await activeCorpusVersion(options.signal);
  // Legacy extracted photos have no independently reviewed permission record.
  if (version === "legacy") return [];
  const query = supabase.rpc("corpus_related_images", { corpus_version: version, image_paths: imageRefs });
  const { data, error } = await (options.signal ? query.abortSignal(options.signal) : query);
  options.signal?.throwIfAborted();

  if (error) {
    if (error.code === "PT409" || error.message === "corpus_selection_unavailable") throw new Error("Corpus selection changed or unavailable during image retrieval");
    options.onDegraded?.();
    logger.error("[TABLE_FALLBACK]", { table: "images", error: error.message ?? String(error) });
    return [];
  }

  return data.flatMap((row: { id: string; path: string; provenance: string }) => {
    const provenance = parseImageProvenance(row.provenance);
    if (!provenance || resolvePermittedImage(row.path, row.provenance).image !== row.path) { options.onDegraded?.(); return []; }
    return [{ id: row.id, path: row.path, caption: provenance.alt, sourcePdf: provenance.credit, provenance: row.provenance }];
  });
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
  queryText?: string,
  options: { signal?: AbortSignal; skipCacheRead?: boolean; corpusVersion?: string } = {}
): Promise<SearchResult> {
  options.signal?.throwIfAborted();
  const corpusVersion = options.corpusVersion ?? await activeCorpusVersion(options.signal);
  const capturedOptions = { ...options, corpusVersion };
  // PE-M2 (#810): a cache hit here skips the vector-search RPC, the rerank
  // call, AND the image lookup — not just the embedding (see embedding-cache.ts).
  // Only cached when queryText is provided; the plain-vector-search fallback
  // path below is not cached (see keying rationale there).
  if (queryText && !options.skipCacheRead) {
    const cached = await searchResultCache.get(queryText, limit, corpusVersion);
    options.signal?.throwIfAborted();
    if (cached) return cached;
  }

  // When reranking, widen the initial search to get more candidates
  const candidateCount = queryText ? RERANK_CANDIDATE_COUNT : limit;
  const candidates = await searchChunks(queryEmbedding, candidateCount, capturedOptions);

  // PE-H3: fire getRelatedImages concurrently with rerankChunks.
  // getRelatedImages only needs the candidate list (not the reranked order),
  // so we can start it immediately using ALL candidate refs. After rerank
  // completes we filter the already-fetched images down to the top-k refs.
  if (!queryText) {
    const allImageRefs = candidates.flatMap((chunk) => chunk.imageRefs || []);
    const uniqueImageRefs = [...new Set(allImageRefs)];
    const images = await getRelatedImages(uniqueImageRefs, capturedOptions);
    return { chunks: candidates, images };
  }

  const allCandidateRefs = candidates.flatMap((chunk) => chunk.imageRefs || []);
  const uniqueCandidateRefs = [...new Set(allCandidateRefs)];

  let degraded = false;
  const onDegraded = () => { degraded = true; };
  // Start both in parallel — neither depends on the other's result yet.
  const [rerankOutcome, allImages] = await Promise.all([
    withRerankTimeout(queryText, candidates, limit, options.signal, onDegraded),
    getRelatedImages(uniqueCandidateRefs, { signal: options.signal, onDegraded, corpusVersion }),
  ]);
  options.signal?.throwIfAborted();
  const { chunks: rerankedChunks, timedOut } = rerankOutcome;

  // Filter images to only those referenced by the reranked top-k chunks.
  const topKRefs = new Set(rerankedChunks.flatMap((chunk) => chunk.imageRefs || []));
  const images = allImages.filter((img) => topKRefs.has(img.path));

  const result: SearchResult = { chunks: rerankedChunks, images };

  // Don't cache a rerank-timeout fallback: it's a degraded (vector-order-only)
  // result, and caching it would serve that degraded ranking to every repeat
  // query for the full TTL even after a transient rerank slowdown passes.
  if (!timedOut && !degraded) {
    void searchResultCache.set(queryText, limit, result, corpusVersion);
  }

  return result;
}

interface RerankOutcome {
  chunks: Chunk[];
  /** True when the rerank timed out and `chunks` fell back to vector order. */
  timedOut: boolean;
}

function withRerankTimeout(
  query: string,
  candidates: Chunk[],
  limit: number,
  signal: AbortSignal | undefined,
  onDegraded: () => void
): Promise<RerankOutcome> {
  const child = createChildAbortController(signal);
  const rerankSignal = child.controller.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const cancellation = new Promise<never>((_, reject) => {
    onAbort = () => reject(rerankSignal.reason);
    if (rerankSignal.aborted) onAbort();
    else rerankSignal.addEventListener("abort", onAbort, { once: true });
  });
  const timeoutPromise = new Promise<RerankOutcome>((resolve) => {
    timer = setTimeout(() => {
      logger.warn("[SEARCH_RERANK_TIMEOUT]", { timeoutMs: RERANK_TIMEOUT_MS });
      resolve({ chunks: candidates.slice(0, limit), timedOut: true });
      child.controller.abort(new DOMException("Rerank deadline exceeded", "TimeoutError"));
    }, RERANK_TIMEOUT_MS);
  });
  return Promise.race([
    rerankChunks(query, candidates, limit, { signal: rerankSignal, onDegraded, timeoutMs: RERANK_TIMEOUT_MS })
      .then(chunks => ({ chunks, timedOut: false })),
    timeoutPromise,
    cancellation,
  ]).finally(() => {
    clearTimeout(timer);
    if (onAbort) rerankSignal.removeEventListener("abort", onAbort);
    child.dispose();
  });
}
