import fs from "fs";
import path from "path";
import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

// Load environment variables from .env.local
config({ path: ".env.local" });

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicApiKey) {
  console.error("Missing ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: anthropicApiKey });

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

async function generateStoriesFromChunks(
  pdfName: string,
  chunks: Chunk[],
  maxStories: number = 10,
  retries: number = 3
): Promise<GeneratedStory[]> {
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

  const prompt = `You are an expert travel content creator for Asturias, Spain. Analyze the following content from "${context.name}" and generate ${maxStories} unique, engaging stories for a travel app.

CONTENT FROM PDF:
${combinedContent}

REQUIREMENTS:
1. Each story should be about a SPECIFIC place, restaurant, activity, or attraction
2. Stories must be in SPANISH
3. Generate diverse content - don't repeat similar places
4. For restaurants: include the restaurant name in the title
5. For places: focus on what makes each unique

OUTPUT FORMAT (JSON array):
[
  {
    "id": "unique-slug-id",
    "slug": "unique-slug-id",
    "title": "Nombre del Lugar",
    "subtitle": "Breve descripción de ubicación o tipo",
    "description": "Descripción atractiva de 2-3 oraciones que invite a visitar. Incluir detalles únicos y atractivos.",
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

Generate exactly ${maxStories} stories. Return ONLY valid JSON, no explanations.`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [
          { role: "user", content: prompt }
        ]
      });

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

      const stories: GeneratedStory[] = JSON.parse(jsonText);

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

    const stories = await generateStoriesFromChunks(pdfName, pdfChunks, maxStories);
    console.log(`Generated ${stories.length} stories`);

    allStories.push(...stories);

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

    const stories = await generateStoriesFromChunks(pdfName, pdfChunks, 8);
    console.log(`Generated ${stories.length} stories`);

    allStories.push(...stories);

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Deduplicate by ID and assign display order
  const uniqueStories = new Map<string, GeneratedStory>();
  let displayOrder = 1;

  for (const story of allStories) {
    if (!uniqueStories.has(story.id)) {
      uniqueStories.set(story.id, {
        ...story,
        id: story.id.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        slug: story.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      });
      displayOrder++;
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

main().catch(console.error);
