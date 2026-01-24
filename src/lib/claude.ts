import type { Chunk, Source } from "@/types";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

// System prompt for the tourism assistant
// Note: Shortened due to Next.js 16 Turbopack fetch payload size limitations
const SYSTEM_PROMPT = `Eres un asistente turistico experto en Asturias, Espana. Tu objetivo es ayudar a los visitantes a descubrir la region.

Instrucciones:
- Responde de forma amable sobre Asturias
- Usa la informacion del contexto proporcionado
- Responde en el mismo idioma en que te preguntan
- Si no tienes informacion, ofrece alternativas`;

// Maximum context size to avoid Next.js 16 Turbopack fetch payload issues
// This is a workaround for ECONNRESET errors with larger payloads
const MAX_CONTEXT_LENGTH = 350;

export async function generateChatResponse(
  userMessage: string,
  context: Chunk[],
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<string> {
  // Build context but limit to MAX_CONTEXT_LENGTH to avoid payload size issues
  let contextText = "";
  for (let i = 0; i < context.length && contextText.length < MAX_CONTEXT_LENGTH; i++) {
    const chunk = context[i];
    const chunkText = `[Fuente ${i + 1}: ${chunk.sourcePdf}${chunk.pageNumber ? `, pag. ${chunk.pageNumber}` : ""}]\n${chunk.content}`;
    if (contextText.length + chunkText.length < MAX_CONTEXT_LENGTH) {
      contextText += (contextText ? "\n\n---\n\n" : "") + chunkText;
    } else {
      // Add truncated chunk
      const remaining = MAX_CONTEXT_LENGTH - contextText.length - 50;
      if (remaining > 100) {
        contextText += (contextText ? "\n\n---\n\n" : "") + chunkText.slice(0, remaining) + "...";
      }
      break;
    }
  }

  const messages: AnthropicMessage[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: "user" as const,
      content: contextText
        ? `Contexto:\n${contextText}\n\nPregunta: ${userMessage}`
        : userMessage,
    },
  ];

  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  };

  // Small delay to avoid connection issues with rapid sequential requests
  await new Promise(resolve => setTimeout(resolve, 100));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data: AnthropicResponse = await response.json();
  const textBlock = data.content.find((block) => block.type === "text");
  return textBlock?.text || "";
}

export function extractSourcesFromChunks(chunks: Chunk[]): Source[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.sectionTitle || chunk.sourcePdf,
    sourcePdf: chunk.sourcePdf,
    pageNumber: chunk.pageNumber,
    snippet: chunk.content.slice(0, 200) + "...",
  }));
}
