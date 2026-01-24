import { NextRequest, NextResponse } from "next/server";
import { generateChatResponse, extractSourcesFromChunks } from "@/lib/claude";
import { generateEmbedding } from "@/lib/embeddings";
import { search } from "@/lib/search";
import type { ChatRequest, ChatResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Generate embedding for the user's query
    const queryEmbedding = await generateEmbedding(message);

    // Search for relevant content
    const { chunks, images } = await search(queryEmbedding, 3);

    // Generate response using Claude with context
    const responseText = await generateChatResponse(
      message,
      chunks,
      conversationHistory
    );

    // Extract sources from chunks
    const sources = extractSourcesFromChunks(chunks);

    const response: ChatResponse = {
      message: responseText,
      sources,
      images,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
