import { supabase } from "./supabase";
import { rerankChunks } from "./rerank";
import type { Chunk, ImageResult, SearchResult } from "@/types";

/** Number of candidates to retrieve from vector search before reranking */
const RERANK_CANDIDATE_COUNT = 10;

export async function searchChunks(
  queryEmbedding: number[],
  limit: number = 5
): Promise<Chunk[]> {
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
    console.error("Image fetch error:", error);
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
  // When reranking, widen the initial search to get more candidates
  const candidateCount = queryText ? RERANK_CANDIDATE_COUNT : limit;
  const candidates = await searchChunks(queryEmbedding, candidateCount);

  // Rerank candidates if query text is available
  const chunks = queryText
    ? await rerankChunks(queryText, candidates, limit)
    : candidates;

  const allImageRefs = chunks.flatMap((chunk) => chunk.imageRefs || []);
  const uniqueImageRefs = [...new Set(allImageRefs)];
  const images = await getRelatedImages(uniqueImageRefs);

  return { chunks, images };
}

// Keyword-based fallback search for specific place names
export async function keywordSearch(query: string, limit: number = 5): Promise<Chunk[]> {
  const { data, error } = await supabase
    .from("chunks")
    .select("id, content, source_pdf, page_number, section_title, image_refs")
    .textSearch("content", query, { type: "websearch", config: "spanish" })
    .limit(limit);

  if (error) {
    console.error("Keyword search error:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    content: row.content,
    sourcePdf: row.source_pdf,
    pageNumber: row.page_number,
    sectionTitle: row.section_title,
    imageRefs: row.image_refs,
  }));
}
