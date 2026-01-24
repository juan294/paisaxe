import { NextRequest, NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/claude";
import { search, keywordSearch } from "@/lib/search";

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5 } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Generate embedding for vector search
    const queryEmbedding = await generateEmbedding(query);

    // Perform hybrid search (vector + keyword)
    const [vectorResults, keywordResults] = await Promise.all([
      search(queryEmbedding, limit),
      keywordSearch(query, limit),
    ]);

    // Merge and deduplicate results
    const seenIds = new Set(vectorResults.chunks.map((c) => c.id));
    const mergedChunks = [
      ...vectorResults.chunks,
      ...keywordResults.filter((c) => !seenIds.has(c.id)),
    ].slice(0, limit);

    return NextResponse.json({
      chunks: mergedChunks,
      images: vectorResults.images,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
