import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { VoyageAIClient } from "voyageai";
import { GENERATED_STORIES } from "../content/processed/extracted-stories";
import { getPlaceholderForStory, needsPlaceholderImage } from "../src/lib/unsplash-placeholders";
import type { StoryCategory } from "../src/types/immersive";

// Load environment variables from .env.local
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const voyageApiKey = process.env.VOYAGE_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  if (!supabaseUrl) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceKey) console.error("  - SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Voyage client is optional for stories-only seeding
let voyage: VoyageAIClient | null = null;
if (voyageApiKey) {
  voyage = new VoyageAIClient({ apiKey: voyageApiKey });
}

const CONTEXTUALIZED_MODEL = "voyage-context-3";
const RATE_LIMIT_DELAY = 500; // 500ms between batches (paid tier: 300 RPM)

interface Chunk {
  content: string;
  sourcePdf: string;
  pageNumber: number;
  sectionTitle?: string;
}

interface Story {
  id: string;
  slug?: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  category: string;
  sourcePdf: string;
  location?: string;
  duration?: string;
  displayOrder?: number;
  relatedStories?: string[];
}

const CHUNKS_FILE = path.join(process.cwd(), "content", "processed", "chunks.json");

// All stories including fallback and additional stories
const ALL_STORIES: Story[] = [
  // Original 8 stories
  {
    id: "lagos-covadonga",
    slug: "lagos-covadonga",
    title: "Lagos de Covadonga",
    subtitle: "Picos de Europa",
    description: "Dos lagos de origen glaciar rodeados de las imponentes cumbres de los Picos de Europa. Un paisaje que quita el aliento en cualquier época del año.",
    image: "/images/stories/lagos-covadonga.png",
    category: "nature",
    sourcePdf: "0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "oviedo-catedral",
    slug: "oviedo-catedral",
    title: "Catedral de Oviedo",
    subtitle: "Capital del Principado",
    description: "La joya del gótico asturiano, con su Cámara Santa declarada Patrimonio de la Humanidad. Siglos de historia en cada piedra.",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920",
    category: "cities",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "fabada",
    slug: "fabada",
    title: "Fabada Asturiana",
    subtitle: "Tradición en cada cucharada",
    description: "El plato más emblemático de nuestra gastronomía. Fabes, chorizo, morcilla y lacón cocinados a fuego lento con todo el sabor de Asturias.",
    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1920",
    category: "food",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "prerromanico",
    slug: "prerromanico",
    title: "Arte Prerrománico",
    subtitle: "Patrimonio de la Humanidad",
    description: "Santa María del Naranco, San Miguel de Lillo... Joyas arquitectónicas únicas en el mundo que cuentan la historia del Reino de Asturias.",
    image: "/images/stories/prerromanico.png",
    category: "culture",
    sourcePdf: "02e93c24-6cac-6d7d-1ca8-59fd8d3fa337.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "ruta-cares",
    slug: "ruta-cares",
    title: "Ruta del Cares",
    subtitle: "La Garganta Divina",
    description: "12 kilómetros excavados en la roca entre Caín y Poncebos. Una de las rutas de senderismo más espectaculares de Europa.",
    image: "/images/stories/ruta-cares.png",
    category: "activities",
    sourcePdf: "0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "playa-silencio",
    slug: "playa-silencio",
    title: "Playa del Silencio",
    subtitle: "Cudillero",
    description: "Un anfiteatro natural de acantilados que abrazan aguas cristalinas. Silencio, paz y la belleza salvaje del Cantábrico.",
    image: "/images/stories/playa-silencio.png",
    category: "nature",
    sourcePdf: "12c86611-ccbe-dbe9-ac86-67ef948a5371.pdf",
    location: "western",
    duration: "day-trip",
  },
  {
    id: "sidra",
    slug: "sidra",
    title: "Sidra Asturiana",
    subtitle: "Cultura líquida",
    description: "El arte del escanciado, los llagares centenarios, el ritual del culín. Más que una bebida, una forma de entender la vida.",
    image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1920",
    category: "food",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "gijon",
    slug: "gijon",
    title: "Gijón",
    subtitle: "Ciudad y mar",
    description: "Cimadevilla, San Lorenzo, el Elogio del Horizonte... Una ciudad que mira al mar con la personalidad única de lo auténtico.",
    image: "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=1920",
    category: "cities",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "central",
    duration: "weekend",
  },
  // Additional 12 stories
  {
    id: "aviles",
    slug: "aviles",
    title: "Avilés",
    subtitle: "Villa del Adelantado",
    description: "El casco antiguo mejor conservado de Asturias, con sus soportales medievales y el moderno Centro Niemeyer que mira al futuro.",
    image: "/images/stories/aviles.png",
    category: "cities",
    sourcePdf: "Guia-visitar-Aviles-ES.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "camino-santiago",
    slug: "camino-santiago",
    title: "Camino de Santiago",
    subtitle: "Ruta Primitiva",
    description: "El camino original que trazó el Rey Alfonso II desde Oviedo. Senderos históricos entre montañas y valles asturianos.",
    image: "https://images.unsplash.com/photo-1541623089466-8e777dd05db2?w=1920",
    category: "activities",
    sourcePdf: "Planificador-Camino-ES.pdf",
    location: "central",
    duration: "week",
  },
  {
    id: "llanes",
    slug: "llanes",
    title: "Llanes",
    subtitle: "Entre playas y montañas",
    description: "Más de 30 playas, acantilados espectaculares y un casco histórico encantador. La esencia del oriente asturiano.",
    image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1920",
    category: "nature",
    sourcePdf: "Cuento-de-Asturias-ES.pdf",
    location: "eastern",
    duration: "weekend",
  },
  {
    id: "cangas-onis",
    slug: "cangas-onis",
    title: "Cangas de Onís",
    subtitle: "Primera capital del reino",
    description: "El puente romano sobre el Sella, la Basílica de Covadonga y la puerta de entrada a los Picos de Europa.",
    image: "/images/stories/cangas-onis.png",
    category: "culture",
    sourcePdf: "Guia-cultura-ES.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "descenso-sella",
    slug: "descenso-sella",
    title: "Descenso del Sella",
    subtitle: "Las Piraguas",
    description: "La fiesta deportiva más emblemática de Asturias. Cada agosto, miles de palistas descienden el río desde Arriondas hasta Ribadesella.",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1920",
    category: "activities",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "quesos-asturianos",
    slug: "quesos-asturianos",
    title: "Quesos Asturianos",
    subtitle: "Más de 40 variedades",
    description: "Cabrales, Gamonéu, Afuega'l Pitu... Una tradición quesera única en Europa, con sabores que van de lo suave a lo intenso.",
    image: "/images/stories/quesos-asturianos.png",
    category: "food",
    sourcePdf: "Guia-cultura-ES.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "museo-jurrasico",
    slug: "museo-jurrasico",
    title: "Museo del Jurásico",
    subtitle: "MUJA - Colunga",
    description: "Una huella de dinosaurio real, esqueletos gigantes y la historia de cuando Asturias era tierra de gigantes prehistóricos.",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920",
    category: "culture",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "senda-oso",
    slug: "senda-oso",
    title: "Senda del Oso",
    subtitle: "Ruta verde del valle",
    description: "30 kilómetros de antiguo trazado ferroviario reconvertidos en sendero. Ideal para familias, entre bosques y el hábitat del oso pardo.",
    image: "https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=1920",
    category: "activities",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "cudillero",
    slug: "cudillero",
    title: "Cudillero",
    subtitle: "El anfiteatro del mar",
    description: "Casas de colores que trepan por la ladera hasta formar un pintoresco anfiteatro que mira al Cantábrico. Un pueblo de pescadores único.",
    image: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?w=1920",
    category: "cities",
    sourcePdf: "Cuento-de-Asturias-ES.pdf",
    location: "western",
    duration: "day-trip",
  },
  {
    id: "taramundi",
    slug: "taramundi",
    title: "Taramundi",
    subtitle: "Tradición cuchillera",
    description: "El pueblo que revitalizó el turismo rural en España. Cuchillos artesanos, ferreiros y la magia del interior occidental asturiano.",
    image: "https://images.unsplash.com/photo-1500049242364-5f500807cdd7?w=1920",
    category: "culture",
    sourcePdf: "Cuento-de-Asturias-ES.pdf",
    location: "western",
    duration: "weekend",
  },
  {
    id: "bufones-pria",
    slug: "bufones-pria",
    title: "Bufones de Pría",
    subtitle: "El rugido del mar",
    description: "Chimeneas naturales por las que el mar lanza chorros de agua y espuma con un sonido atronador. La fuerza del Cantábrico en estado puro.",
    image: "https://images.unsplash.com/photo-1509233725247-49e657c54213?w=1920",
    category: "nature",
    sourcePdf: "Cuento-de-Asturias-ES.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "luarca",
    slug: "luarca",
    title: "Luarca",
    subtitle: "La villa blanca de la costa",
    description: "Puerto pesquero, cementerio con vistas al mar y calles empedradas. La elegancia marinera del occidente asturiano.",
    image: "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1920",
    category: "cities",
    sourcePdf: "Cuento-de-Asturias-ES.pdf",
    location: "western",
    duration: "day-trip",
  },
];

// Existing slugs from original stories to avoid duplicates
const existingSlugs = new Set(ALL_STORIES.map(s => s.slug));

// Add generated stories that don't conflict with existing ones
const filteredGenerated = GENERATED_STORIES
  .filter(s => !existingSlugs.has(s.slug))
  .map((s, i) => ({
    ...s,
    displayOrder: s.displayOrder ?? (ALL_STORIES.length + i),
  }));

ALL_STORIES.push(...filteredGenerated);

async function seedStories(): Promise<void> {
  console.log(`\nSeeding ${ALL_STORIES.length} stories...`);

  const records = ALL_STORIES.map((story, index) => {
    const slug = story.slug || story.id;

    // Auto-assign placeholder for stories without an image or with old Unsplash URLs
    let imagePath = story.image || null;
    let imageSource: string | null = null;
    const needsReplacement = needsPlaceholderImage({ image: story.image });
    if (needsReplacement) {
      const placeholder = getPlaceholderForStory(slug, story.category as StoryCategory);
      imagePath = placeholder.image;
      imageSource = placeholder.imageSource;
      console.log(`  → Assigned placeholder image for "${story.title}"`);
    }

    return {
      slug,
      title: story.title,
      subtitle: story.subtitle || null,
      description: story.description || null,
      image_path: imagePath,
      image_source: imageSource,
      category: story.category,
      source_pdf: story.sourcePdf || null,
      location: story.location || null,
      duration: story.duration || null,
      display_order: story.displayOrder ?? index,
      is_active: true,
      related_stories: story.relatedStories || null,
      metadata: {},
    };
  });

  const { error } = await supabase.from("stories").insert(records);

  if (error) {
    console.error("Error inserting stories:", error.message);
  } else {
    console.log(`Successfully seeded ${records.length} stories.`);
  }
}

async function clearStories(): Promise<void> {
  console.log("Clearing existing stories...");

  const { error } = await supabase
    .from("stories")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    console.error("Error clearing stories:", error.message);
  } else {
    console.log("Stories cleared.");
  }
}

/**
 * Group chunks by their source PDF so that chunks from the same document
 * can be embedded together with contextual awareness.
 */
function groupChunksByPdf(chunks: Chunk[]): Map<string, Chunk[]> {
  const groups = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const existing = groups.get(chunk.sourcePdf);
    if (existing) {
      existing.push(chunk);
    } else {
      groups.set(chunk.sourcePdf, [chunk]);
    }
  }
  return groups;
}

async function seedChunks(): Promise<void> {
  if (!voyage) {
    console.error("Voyage API key not set. Cannot seed chunks without embeddings.");
    console.error("Set VOYAGE_API_KEY environment variable to seed chunks.");
    process.exit(1);
  }

  if (!fs.existsSync(CHUNKS_FILE)) {
    console.error("Chunks file not found. Run 'npm run process-pdfs' first.");
    process.exit(1);
  }

  const chunks: Chunk[] = JSON.parse(fs.readFileSync(CHUNKS_FILE, "utf-8"));
  console.log(`Loading ${chunks.length} chunks into database...`);
  console.log(`Using Voyage AI model: ${CONTEXTUALIZED_MODEL} (contextualized embeddings)`);

  // Group chunks by source PDF for contextualized embedding
  const pdfGroups = groupChunksByPdf(chunks);
  console.log(`Grouped chunks into ${pdfGroups.size} PDF document groups`);

  let processed = 0;
  let totalTokens = 0;

  // Process each PDF group with contextualized embeddings
  for (const [sourcePdf, groupChunks] of pdfGroups) {
    const texts = groupChunks.map((chunk) => chunk.content);
    console.log(`\nProcessing "${sourcePdf}": ${texts.length} chunks`);

    try {
      // Generate contextualized embeddings for all chunks in this PDF group
      const result = await voyage.contextualizedEmbed({
        inputs: [texts],
        model: CONTEXTUALIZED_MODEL,
        inputType: "document",
      });

      if (!result.data || result.data.length === 0 || !result.data[0].data) {
        throw new Error(`No contextualized embeddings returned for ${sourcePdf}`);
      }

      const chunkEmbeddings = result.data[0].data;

      if (chunkEmbeddings.length !== texts.length) {
        throw new Error(
          `Embedding count mismatch for ${sourcePdf}: expected ${texts.length}, got ${chunkEmbeddings.length}`
        );
      }

      totalTokens += result.usage?.totalTokens || 0;

      // Prepare records for database
      const records = groupChunks.map((chunk, idx) => ({
        content: chunk.content,
        embedding: chunkEmbeddings[idx].embedding,
        source_pdf: chunk.sourcePdf,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle || null,
        image_refs: [],
        metadata: {},
      }));

      // Insert into database
      const { error } = await supabase.from("chunks").insert(records);

      if (error) {
        console.error(`Error inserting chunks for ${sourcePdf}:`, error.message);
      } else {
        processed += groupChunks.length;
        console.log(
          `  Processed ${processed}/${chunks.length} chunks (${totalTokens.toLocaleString()} tokens used)`
        );
      }

      // Small delay between groups
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    } catch (error) {
      console.error(`Error processing ${sourcePdf}:`, error);
      // Continue with next group
    }
  }

  console.log(`\nDatabase seeding complete!`);
  console.log(`Total tokens used: ${totalTokens.toLocaleString()}`);
  console.log(`Estimated cost: $${((totalTokens / 1000) * 0.00018).toFixed(4)}`);
}

async function clearDatabase(): Promise<void> {
  console.log("Clearing existing data...");

  const { error: chunksError } = await supabase
    .from("chunks")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (chunksError) {
    console.error("Error clearing chunks:", chunksError.message);
  }

  const { error: imagesError } = await supabase
    .from("images")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (imagesError) {
    console.error("Error clearing images:", imagesError.message);
  }

  console.log("Database cleared.");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const clearAll = args.includes("--clear");
  const storiesOnly = args.includes("--stories");
  const chunksOnly = args.includes("--chunks");

  console.log("=== Paisaxe Database Seeder ===\n");

  if (storiesOnly) {
    // Seed only stories
    if (clearAll) {
      await clearStories();
    }
    await seedStories();
  } else if (chunksOnly) {
    // Seed only chunks
    if (clearAll) {
      await clearDatabase();
    }
    await seedChunks();
  } else {
    // Seed everything
    if (clearAll) {
      await clearDatabase();
      await clearStories();
    }
    await seedChunks();
    await seedStories();
  }

  console.log("\n=== Seeding complete ===");
}

main().catch(console.error);
