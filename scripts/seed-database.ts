import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { VoyageAIClient } from "voyageai";

// Load environment variables from .env.local
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const voyageApiKey = process.env.VOYAGE_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !voyageApiKey) {
  console.error("Missing required environment variables:");
  if (!supabaseUrl) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceKey) console.error("  - SUPABASE_SERVICE_KEY");
  if (!voyageApiKey) console.error("  - VOYAGE_API_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const voyage = new VoyageAIClient({ apiKey: voyageApiKey });

const EMBEDDING_MODEL = "voyage-3";
const BATCH_SIZE = 8; // Small batches for rate limiting
const RATE_LIMIT_DELAY = 25000; // 25 seconds between batches (free tier: 3 RPM)

interface Chunk {
  content: string;
  sourcePdf: string;
  pageNumber: number;
  sectionTitle?: string;
}

const CHUNKS_FILE = path.join(process.cwd(), "content", "processed", "chunks.json");

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const result = await voyage.embed({
    input: texts,
    model: EMBEDDING_MODEL,
  });

  if (!result.data) {
    throw new Error("No embeddings returned from Voyage AI");
  }

  return result.data.map((d) => d.embedding);
}

async function seedChunks(): Promise<void> {
  if (!fs.existsSync(CHUNKS_FILE)) {
    console.error("Chunks file not found. Run 'npm run process-pdfs' first.");
    process.exit(1);
  }

  const chunks: Chunk[] = JSON.parse(fs.readFileSync(CHUNKS_FILE, "utf-8"));
  console.log(`Loading ${chunks.length} chunks into database...`);
  console.log(`Using Voyage AI model: ${EMBEDDING_MODEL}`);

  let processed = 0;
  let totalTokens = 0;

  // Process in batches for embeddings
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((chunk) => chunk.content);

    try {
      // Generate embeddings for batch
      const result = await voyage.embed({
        input: texts,
        model: EMBEDDING_MODEL,
      });

      if (!result.data || result.data.length !== texts.length) {
        throw new Error(`Embedding count mismatch for batch ${i}`);
      }

      totalTokens += result.usage?.totalTokens || 0;

      // Prepare records for database
      const records = batch.map((chunk, idx) => ({
        content: chunk.content,
        embedding: result.data![idx].embedding,
        source_pdf: chunk.sourcePdf,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle || null,
        image_refs: [],
        metadata: {},
      }));

      // Insert into database
      const { error } = await supabase.from("chunks").insert(records);

      if (error) {
        console.error(`Error inserting batch ${i}:`, error.message);
      } else {
        processed += batch.length;
        console.log(`Processed ${processed}/${chunks.length} chunks (${totalTokens.toLocaleString()} tokens used)`);
      }

      // Rate limiting - Free tier has 3 RPM limit
      console.log(`  Waiting ${RATE_LIMIT_DELAY / 1000}s for rate limit...`);
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    } catch (error) {
      console.error(`Error processing batch ${i}:`, error);
      // Continue with next batch
    }
  }

  console.log(`\nDatabase seeding complete!`);
  console.log(`Total tokens used: ${totalTokens.toLocaleString()}`);
  console.log(`Estimated cost: $${((totalTokens / 1000) * 0.0001).toFixed(4)}`);
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

  if (args.includes("--clear")) {
    await clearDatabase();
  }

  await seedChunks();
}

main().catch(console.error);
