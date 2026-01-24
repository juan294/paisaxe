import { supabase } from "./supabase";
import type { Chunk, ImageResult, SearchResult } from "@/types";

export async function searchChunks(
  queryEmbedding: number[],
  limit: number = 5
): Promise<Chunk[]> {
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit,
  });

  if (error) {
    console.error("Search error:", error);
    return [];
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

export async function search(
  queryEmbedding: number[],
  limit: number = 5
): Promise<SearchResult> {
  const chunks = await searchChunks(queryEmbedding, limit);

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
    .textSearch("content", query, { type: "websearch" })
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
