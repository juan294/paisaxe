import fs from "fs";
import path from "path";
import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { CHAT_MODEL } from "../src/lib/models";

// Load environment variables from .env.local
config({ path: ".env.local" });

// --- Exported types ---

interface Chunk {
  content: string;
  sourcePdf: string;
  pageNumber: number;
  sectionTitle?: string;
}

interface GeneratedStory {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  category: "nature" | "cities" | "food" | "culture" | "activities";
  sourcePdf: string;
  location?: "eastern" | "central" | "western";
  duration?: "day-trip" | "weekend" | "week";
}

export interface GeneratedStoryWithQuote extends GeneratedStory {
  sourceQuote: string;
}

export interface ValidationResult {
  valid: GeneratedStoryWithQuote[];
  excluded: Array<{ story: GeneratedStoryWithQuote; reason: string }>;
}

// Known non-Asturian places near the border that are commonly confused
export const NON_ASTURIAN_BLOCKLIST = [
  // Galicia (west)
  "Ribadeo",
  "Mondoñedo",
  "Foz",
  "Viveiro",
  "Lugo",
  "A Fonsagrada",
  // Cantabria (east)
  "Santander",
  "Castro Urdiales",
  "San Vicente de la Barquera",
  "Santillana del Mar",
  "Comillas",
  "Fuente Dé",
  "Potes",
  "Camaleño",
  // León (south)
  "León",
  "Ponferrada",
  "Villablino",
];

// --- Usage reporting ---

/**
 * One stdout line with the four usage fields of a Messages API call. This
 * script has no database, so it prints usage instead of writing
 * anthropic_usage (see .claude/rules/prompt-caching.md). Its prompt is not
 * cached: the static instructions are below the model minimum on their own.
 */
export function formatUsageLine(
  pdfName: string,
  attempt: number,
  usage: Pick<
    Anthropic.Usage,
    "input_tokens" | "output_tokens" | "cache_creation_input_tokens" | "cache_read_input_tokens"
  >
): string {
  return (
    `[usage] ${pdfName} attempt ${attempt}: ` +
    `input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens} ` +
    `cache_creation_input_tokens=${usage.cache_creation_input_tokens ?? 0} ` +
    `cache_read_input_tokens=${usage.cache_read_input_tokens ?? 0}`
  );
}

// --- Validation function ---

/**
 * Validates generated stories against source chunks and geographic constraints.
 * Returns valid stories and excluded stories with reasons.
 */
export function validateGeneratedStories(
  stories: GeneratedStoryWithQuote[],
  chunkTexts: string[],
): ValidationResult {
  const valid: GeneratedStoryWithQuote[] = [];
  const excluded: ValidationResult["excluded"] = [];

  const allChunkText = chunkTexts.join(" ").toLowerCase();

  for (const story of stories) {
    const reasons: string[] = [];

    // Citation check: verify sourceQuote appears in chunks (fuzzy/substring match)
    const quote = story.sourceQuote?.toLowerCase().trim();
    if (!quote || !allChunkText.includes(quote)) {
      reasons.push("Failed citation check: sourceQuote not found in source chunks");
    }

    // Geographic check: blocklist against title and subtitle
    const titleAndSubtitle = `${story.title} ${story.subtitle}`.toLowerCase();
    for (const place of NON_ASTURIAN_BLOCKLIST) {
      if (titleAndSubtitle.includes(place.toLowerCase())) {
        reasons.push(`Failed geographic check: contains non-Asturian place "${place}"`);
        break;
      }
    }

    if (reasons.length > 0) {
      excluded.push({ story, reason: reasons.join("; ") });
    } else {
      valid.push(story);
    }
  }

  return { valid, excluded };
}

// --- Internal helpers (not exported) ---

const CHUNKS_FILE = path.join(process.cwd(), "content", "processed", "chunks.json");
const OUTPUT_FILE = path.join(process.cwd(), "content", "processed", "generated-stories.json");

// PDF name mapping for better context
const PDF_CONTEXT: Record<string, { name: string; type: string; expectedCategory: string }> = {
  "0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf": {
    name: "Mesas de Asturias - Restaurant Guide",
    type: "restaurants",
    expectedCategory: "food"
  },
  "Guia-visitar-Oviedo-ES.pdf": {
    name: "Oviedo City Guide",
    type: "city",
    expectedCategory: "cities"
  },
  "Guia-visitar-Gijon-ES.pdf": {
    name: "Gijón City Guide",
    type: "city",
    expectedCategory: "cities"
  },
  "Guia-visitar-Aviles-ES.pdf": {
    name: "Avilés City Guide",
    type: "city",
    expectedCategory: "cities"
  },
  "Guia-cultura-ES.pdf": {
    name: "Culture Guide",
    type: "culture",
    expectedCategory: "culture"
  },
  "Asturias-en-familia-ES.pdf": {
    name: "Family Activities Guide",
    type: "activities",
    expectedCategory: "activities"
  },
  "Planificador-Camino-ES.pdf": {
    name: "Camino de Santiago Planner",
    type: "activities",
    expectedCategory: "activities"
  },
  "Cuento-de-Asturias-ES.pdf": {
    name: "Story of Asturias",
    type: "culture",
    expectedCategory: "culture"
  },
};

async function loadChunks(): Promise<Chunk[]> {
  const data = fs.readFileSync(CHUNKS_FILE, "utf-8");
  return JSON.parse(data);
}

function groupChunksByPdf(chunks: Chunk[]): Map<string, Chunk[]> {
  const grouped = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const existing = grouped.get(chunk.sourcePdf) || [];
    existing.push(chunk);
    grouped.set(chunk.sourcePdf, existing);
  }
  return grouped;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY environment variable");
    process.exit(1);
  }
  return new Anthropic({ apiKey });
}

async function generateStoriesFromChunks(
  anthropic: Anthropic,
  pdfName: string,
  chunks: Chunk[],
  maxStories: number = 10,
  retries: number = 3
): Promise<GeneratedStoryWithQuote[]> {
  const context = PDF_CONTEXT[pdfName] || {
    name: pdfName,
    type: "general",
    expectedCategory: "culture"
  };

  // Combine chunks content (limit to avoid token limits)
  const combinedContent = chunks
    .slice(0, 30) // Take first 30 chunks
    .map(c => c.content)
    .join("\n\n---\n\n")
    .slice(0, 50000); // Limit total characters

  const prompt = `You are an expert content extractor for Asturias, Spain tourism. Your task is to extract stories about places EXPLICITLY NAMED in the following PDF content from "${context.name}".

CRITICAL CONSTRAINTS:
- ONLY create stories about places, restaurants, or attractions that are EXPLICITLY NAMED in the provided text below.
- Do NOT use your training knowledge to add places not mentioned in the text.
- Do NOT invent or embellish details beyond what the text states.
- All places MUST be within the Principado de Asturias autonomous community. Exclude any places in Galicia (e.g. Ribadeo, Mondoñedo), Cantabria (e.g. Santander, Fuente Dé, Potes), León, or other regions — even if mentioned in the text as nearby or as excursions.
- If the text mentions fewer than ${maxStories} distinct Asturian places, return only as many as you can verify in the text. Do NOT pad with invented entries.

CONTENT FROM PDF:
${combinedContent}

REQUIREMENTS:
1. Each story must be about a SPECIFIC place, restaurant, activity, or attraction NAMED in the text above
2. Stories must be in SPANISH
3. Generate diverse content - don't repeat similar places
4. For restaurants: include the restaurant name in the title
5. For places: focus on what makes each unique, using details from the text
6. For each story, provide a "sourceQuote" — the exact sentence or phrase from the PDF text above where this place is named. This must be a verbatim quote from the text.

OUTPUT FORMAT (JSON array):
[
  {
    "id": "unique-slug-id",
    "slug": "unique-slug-id",
    "title": "Nombre del Lugar",
    "subtitle": "Breve descripción de ubicación o tipo",
    "description": "Descripción atractiva de 2-3 oraciones basada en la información del texto.",
    "sourceQuote": "Frase exacta del texto donde se menciona este lugar",
    "category": "${context.expectedCategory}",
    "location": "eastern" | "central" | "western",
    "duration": "day-trip" | "weekend" | "week"
  }
]

LOCATION GUIDE:
- eastern: Picos de Europa, Covadonga, Cangas de Onís, Ribadesella, Llanes
- central: Oviedo, Gijón, Avilés, Mieres, Langreo
- western: Luarca, Tapia, Navia, Cudillero, Pravia

CATEGORY OPTIONS: nature, cities, food, culture, activities

Generate up to ${maxStories} stories. Return ONLY valid JSON, no explanations.`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: 8000,
        messages: [
          { role: "user", content: prompt }
        ]
      });
      console.log(formatUsageLine(pdfName, attempt, response.usage));

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      // Extract JSON from response
      let jsonText = content.text.trim();

      // Handle markdown code blocks
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      const stories: GeneratedStoryWithQuote[] = JSON.parse(jsonText);

      // Add source PDF and default image
      return stories.map(story => ({
        ...story,
        sourcePdf: pdfName,
        image: "", // Will be assigned later
      }));
    } catch (error) {
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) {
        console.error(`Error generating stories for ${pdfName} after ${retries} attempts:`, error);
        return [];
      }
      console.log(`Attempt ${attempt} failed for ${pdfName}, retrying in ${attempt * 5}s...`);
      await sleep(attempt * 5000);
    }
  }
  return [];
}

async function main() {
  const anthropic = createAnthropicClient();

  console.log("Loading chunks...");
  const chunks = await loadChunks();
  console.log(`Loaded ${chunks.length} chunks`);

  const groupedChunks = groupChunksByPdf(chunks);
  console.log(`Found ${groupedChunks.size} PDFs`);

  const allStories: GeneratedStory[] = [];

  // Process key PDFs with different story counts
  const pdfConfig: [string, number][] = [
    // Restaurant guide - generate many restaurant stories
    ["0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf", 30],
    // City guides
    ["Guia-visitar-Oviedo-ES.pdf", 15],
    ["Guia-visitar-Gijon-ES.pdf", 15],
    ["Guia-visitar-Aviles-ES.pdf", 10],
    // Culture and activities
    ["Guia-cultura-ES.pdf", 15],
    ["Asturias-en-familia-ES.pdf", 15],
    ["Planificador-Camino-ES.pdf", 10],
  ];

  for (const [pdfName, maxStories] of pdfConfig) {
    const pdfChunks = groupedChunks.get(pdfName);
    if (!pdfChunks) {
      console.log(`PDF not found: ${pdfName}`);
      continue;
    }

    console.log(`\nProcessing ${pdfName} (${pdfChunks.length} chunks)...`);
    console.log(`Generating up to ${maxStories} stories...`);

    const rawStories = await generateStoriesFromChunks(anthropic, pdfName, pdfChunks, maxStories);
    console.log(`Generated ${rawStories.length} raw stories`);

    // Validate against source chunks
    const chunkTexts = pdfChunks.map(c => c.content);
    const { valid, excluded } = validateGeneratedStories(rawStories, chunkTexts);

    if (excluded.length > 0) {
      console.warn(`⚠️  Excluded ${excluded.length} stories from ${pdfName}:`);
      for (const { story, reason } of excluded) {
        console.warn(`   - "${story.title}": ${reason}`);
      }
    }

    console.log(`✓ ${valid.length} stories passed validation`);

    // Strip sourceQuote before adding to output (validation-only field)
    const cleaned: GeneratedStory[] = valid.map(({ sourceQuote: _sourceQuote, ...rest }) => rest);
    allStories.push(...cleaned);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Also process some UUID PDFs for more variety
  const uuidPdfs = Array.from(groupedChunks.keys())
    .filter(name => !PDF_CONTEXT[name] && name.includes("-"))
    .slice(0, 5); // Take 5 additional PDFs

  for (const pdfName of uuidPdfs) {
    const pdfChunks = groupedChunks.get(pdfName)!;
    console.log(`\nProcessing additional PDF ${pdfName} (${pdfChunks.length} chunks)...`);

    const rawStories = await generateStoriesFromChunks(anthropic, pdfName, pdfChunks, 8);
    console.log(`Generated ${rawStories.length} raw stories`);

    const chunkTexts = pdfChunks.map(c => c.content);
    const { valid, excluded } = validateGeneratedStories(rawStories, chunkTexts);

    if (excluded.length > 0) {
      console.warn(`⚠️  Excluded ${excluded.length} stories from ${pdfName}:`);
      for (const { story, reason } of excluded) {
        console.warn(`   - "${story.title}": ${reason}`);
      }
    }

    console.log(`✓ ${valid.length} stories passed validation`);

    const cleaned: GeneratedStory[] = valid.map(({ sourceQuote: _sourceQuote, ...rest }) => rest);
    allStories.push(...cleaned);

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Deduplicate by ID and assign display order
  const uniqueStories = new Map<string, GeneratedStory>();
  for (const story of allStories) {
    if (!uniqueStories.has(story.id)) {
      uniqueStories.set(story.id, {
        ...story,
        id: story.id.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        slug: story.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      });
    }
  }

  const finalStories = Array.from(uniqueStories.values());

  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalStories, null, 2));
  console.log(`\n✅ Generated ${finalStories.length} unique stories`);
  console.log(`Saved to: ${OUTPUT_FILE}`);

  // Print summary by category
  const byCategory = new Map<string, number>();
  for (const story of finalStories) {
    byCategory.set(story.category, (byCategory.get(story.category) || 0) + 1);
  }

  console.log("\nStories by category:");
  for (const [category, count] of byCategory) {
    console.log(`  ${category}: ${count}`);
  }

  // Generate TypeScript code for seed-database.ts
  const tsOutput = `// Generated stories - add to ALL_STORIES in seed-database.ts
const GENERATED_STORIES: Story[] = ${JSON.stringify(finalStories, null, 2)};`;

  const tsOutputFile = path.join(process.cwd(), "content", "processed", "generated-stories.ts");
  fs.writeFileSync(tsOutputFile, tsOutput);
  console.log(`\nTypeScript output saved to: ${tsOutputFile}`);
}

// Only run main() when executed directly (not when imported for tests)
const isDirectExecution = process.argv[1]?.endsWith("generate-stories.ts") ||
  process.argv[1]?.endsWith("generate-stories");

if (isDirectExecution) {
  main().catch(console.error);
}
