import Anthropic from "@anthropic-ai/sdk";
import type { Chunk, Source, ImageResult } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `Eres un asistente turistico experto en Asturias, Espana. Tu objetivo es ayudar a los visitantes a descubrir lo mejor de la region: sus paisajes, gastronomia, cultura, rutas de senderismo, playas, pueblos y tradiciones.

Instrucciones:
- Responde siempre de forma amable y entusiasta sobre Asturias
- Usa la informacion del contexto proporcionado para dar respuestas precisas
- Si mencionas lugares, actividades o platos, da detalles utiles
- Responde en el mismo idioma en que te preguntan
- Si no tienes informacion suficiente en el contexto, di que no tienes esa informacion especifica pero ofrece alternativas relacionadas
- Incluye consejos practicos cuando sea relevante (mejor epoca, como llegar, que llevar)
- Menciona las fuentes cuando cites informacion especifica

Contexto sobre Asturias:
- Region del norte de Espana conocida como "Paraiso Natural"
- Famosa por: sidra, fabada, queso Cabrales, Picos de Europa, playas, prerromanico asturiano
- Principales ciudades: Oviedo (capital), Gijon, Aviles
- El Camino de Santiago pasa por Asturias (Camino del Norte y Camino Primitivo)`;

export async function generateChatResponse(
  userMessage: string,
  context: Chunk[],
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<string> {
  const contextText = context
    .map(
      (chunk, i) =>
        `[Fuente ${i + 1}: ${chunk.sourcePdf}${chunk.pageNumber ? `, pag. ${chunk.pageNumber}` : ""}]\n${chunk.content}`
    )
    .join("\n\n---\n\n");

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    {
      role: "user",
      content: `Contexto relevante de las guias turisticas:\n\n${contextText}\n\n---\n\nPregunta del visitante: ${userMessage}`,
    },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : "";
}

// Embeddings are now handled by src/lib/embeddings.ts using Voyage AI
export { generateEmbedding } from "./embeddings";

export function extractSourcesFromChunks(chunks: Chunk[]): Source[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.sectionTitle || chunk.sourcePdf,
    sourcePdf: chunk.sourcePdf,
    pageNumber: chunk.pageNumber,
    snippet: chunk.content.slice(0, 200) + "...",
  }));
}
