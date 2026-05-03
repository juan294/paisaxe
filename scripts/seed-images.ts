/**
 * Seed images from extracted PDFs into Supabase Storage and the images table.
 *
 * This script:
 * 1. Reads the image manifest and chunks.json
 * 2. Selects the best image per (sourcePdf, pageNumber) that has chunks
 * 3. Uploads images to Supabase Storage (pdf-images bucket)
 * 4. Inserts rows into the images table
 * 5. Generates content/processed/image-refs-map.json for seed-database.ts
 *
 * Usage:
 *   npm run seed-images          # Upload and seed (skip existing)
 *   npm run seed-images:clear    # Clear and re-upload everything
 */

import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

type SeedDatabase = {
  public: {
    Tables: {
      images: {
        Row: {
          id: string;
        };
        Insert: {
          path: string;
          caption: string | null;
          source_pdf: string;
          page_number: number;
          tags: string[];
        };
        Update: Partial<SeedDatabase["public"]["Tables"]["images"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

type SeedSupabaseClient = ReturnType<typeof createClient<SeedDatabase>>;

config({ path: ".env.local" });

// --- Types (exported for tests) ---

export interface ManifestImage {
  filename: string;
  sourcePdf: string;
  pageNumber: number;
  width: number;
  height: number;
  path: string;
  aspectRatio?: number;
  type?: "extracted" | "rendered";
}

export interface ProcessedChunk {
  content: string;
  sourcePdf: string;
  pageNumber: number;
  sectionTitle?: string;
}

export interface SelectedImage {
  image: ManifestImage;
  publicUrl: string;
}

interface Manifest {
  extractedAt: string;
  totalImages: number;
  totalPdfs: number;
  images: ManifestImage[];
}

// --- Constants ---

const CONTENT_DIR = path.join(process.cwd(), "content");
const IMAGES_DIR = path.join(CONTENT_DIR, "images");
const MANIFEST_PATH = path.join(IMAGES_DIR, "manifest.json");
const CHUNKS_PATH = path.join(CONTENT_DIR, "processed", "chunks.json");
const OUTPUT_DIR = path.join(CONTENT_DIR, "processed");
const IMAGE_REFS_MAP_PATH = path.join(OUTPUT_DIR, "image-refs-map.json");

const BUCKET_NAME = "pdf-images";
const MIN_WIDTH = 400;
const UPLOAD_CONCURRENCY = 10;
const UPLOAD_BATCH_DELAY = 200;

// --- Pure functions (exported for testing) ---

/**
 * Score an image for content suitability. Higher is better.
 * Reuses the heuristic from map-story-images.ts.
 */
export function scoreImage(img: ManifestImage): number {
  let score = 0;

  // Prefer extracted (embedded photography) over page renders (includes text/chrome)
  if (img.type === "extracted") {
    score += 100;
  }

  // Prefer early pages (cover photos, hero images)
  if (img.pageNumber <= 1) {
    score += 50;
  } else if (img.pageNumber <= 3) {
    score += 30;
  } else if (img.pageNumber <= 5) {
    score += 10;
  }

  // Prefer landscape orientation
  if (img.width > img.height) {
    score += 20;
  }

  // Prefer larger images (more detail), cap at 50
  const area = img.width * img.height;
  score += Math.min(area / 10000, 50);

  return score;
}

/**
 * Select the best image per (sourcePdf, pageNumber) from the manifest.
 * Only includes images on pages that have chunks and meet minimum width.
 */
export function selectImages(
  images: ManifestImage[],
  chunks: ProcessedChunk[],
  minWidth: number = MIN_WIDTH
): Array<{ image: ManifestImage }> {
  // Build set of (sourcePdf, pageNumber) pairs present in chunks
  const chunkPages = new Set<string>();
  for (const chunk of chunks) {
    chunkPages.add(`${chunk.sourcePdf}:${chunk.pageNumber}`);
  }

  // Filter: minimum width AND page has chunks
  const candidates = images.filter(
    (img) =>
      img.width >= minWidth &&
      chunkPages.has(`${img.sourcePdf}:${img.pageNumber}`)
  );

  // Group by (sourcePdf, pageNumber)
  const groups = new Map<string, ManifestImage[]>();
  for (const img of candidates) {
    const key = `${img.sourcePdf}:${img.pageNumber}`;
    const group = groups.get(key) || [];
    group.push(img);
    groups.set(key, group);
  }

  // Pick top-1 per group by score
  const selected: Array<{ image: ManifestImage }> = [];
  for (const group of groups.values()) {
    const sorted = group
      .map((img) => ({ img, score: scoreImage(img) }))
      .sort((a, b) => b.score - a.score);
    selected.push({ image: sorted[0].img });
  }

  return selected;
}

/**
 * Build a mapping from "sourcePdf:pageNumber" to array of public URLs.
 * Used by seed-database.ts to populate chunk image_refs.
 */
export function buildImageRefsMap(
  selectedImages: SelectedImage[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const entry of selectedImages) {
    const key = `${entry.image.sourcePdf}:${entry.image.pageNumber}`;
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(entry.publicUrl);
  }
  return map;
}

/**
 * Derive a caption for an image from the chunk on the same page.
 * Returns the first non-empty sectionTitle found, or null.
 */
export function deriveCaption(
  chunks: ProcessedChunk[],
  sourcePdf: string,
  pageNumber: number
): string | null {
  for (const chunk of chunks) {
    if (
      chunk.sourcePdf === sourcePdf &&
      chunk.pageNumber === pageNumber &&
      chunk.sectionTitle
    ) {
      return chunk.sectionTitle;
    }
  }
  return null;
}

// --- Script logic (not exported) ---

async function uploadBatch(
  supabase: SeedSupabaseClient,
  batch: Array<{ image: ManifestImage; filePath: string; storagePath: string }>,
  chunks: ProcessedChunk[]
): Promise<SelectedImage[]> {
  const results: SelectedImage[] = [];

  const uploads = batch.map(async ({ image, filePath, storagePath }) => {
    const fileBuffer = fs.readFileSync(filePath);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error(`  FAIL upload ${storagePath}: ${uploadError.message}`);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;
    const caption = deriveCaption(chunks, image.sourcePdf, image.pageNumber);

    // Insert into images table
    const { error: insertError } = await supabase.from("images").insert({
      path: publicUrl,
      caption,
      source_pdf: image.sourcePdf,
      page_number: image.pageNumber,
      tags: [],
    });

    if (insertError) {
      console.error(`  FAIL insert ${storagePath}: ${insertError.message}`);
      return null;
    }

    return { image, publicUrl };
  });

  const settled = await Promise.all(uploads);
  for (const result of settled) {
    if (result) {
      results.push(result);
    }
  }

  return results;
}

async function clearImages(
  supabase: SeedSupabaseClient
): Promise<void> {
  console.log("Clearing images table...");
  const { error: deleteError } = await supabase
    .from("images")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    console.error("Error clearing images table:", deleteError.message);
  } else {
    console.log("Images table cleared.");
  }

  console.log("Clearing pdf-images storage bucket...");
  // List all files in the bucket and delete them
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list("", { limit: 1000 });

  if (listError) {
    console.error("Error listing bucket files:", listError.message);
    return;
  }

  if (files && files.length > 0) {
    // List files in each folder
    const allPaths: string[] = [];
    for (const item of files) {
      if (item.id === null) {
        // It's a folder, list contents
        const { data: folderFiles } = await supabase.storage
          .from(BUCKET_NAME)
          .list(item.name, { limit: 10000 });
        if (folderFiles) {
          for (const file of folderFiles) {
            allPaths.push(`${item.name}/${file.name}`);
          }
        }
      } else {
        allPaths.push(item.name);
      }
    }

    if (allPaths.length > 0) {
      // Delete in batches of 100
      for (let i = 0; i < allPaths.length; i += 100) {
        const batch = allPaths.slice(i, i + 100);
        const { error: removeError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(batch);
        if (removeError) {
          console.error(`Error removing files batch ${i}:`, removeError.message);
        }
      }
      console.log(`Removed ${allPaths.length} files from storage.`);
    }
  } else {
    console.log("Storage bucket already empty.");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const clearFlag = args.includes("--clear");

  console.log("=== Paisaxe Image Seeder ===\n");

  // Validate environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required environment variables:");
    if (!supabaseUrl) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseServiceKey) console.error("  - SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  const supabase = createClient<SeedDatabase>(supabaseUrl, supabaseServiceKey);

  // Read manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("Manifest not found at", MANIFEST_PATH);
    console.log("Run 'npm run extract-images' first to extract images from PDFs.");
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  console.log(`Loaded manifest: ${manifest.totalImages} images from ${manifest.totalPdfs} PDFs`);

  // Read chunks
  if (!fs.existsSync(CHUNKS_PATH)) {
    console.error("Chunks file not found at", CHUNKS_PATH);
    console.log("Run 'npm run process-pdfs' first to extract text from PDFs.");
    process.exit(1);
  }

  const chunks: ProcessedChunk[] = JSON.parse(fs.readFileSync(CHUNKS_PATH, "utf-8"));
  console.log(`Loaded ${chunks.length} chunks`);

  // Clear if requested
  if (clearFlag) {
    await clearImages(supabase);
    console.log();
  }

  // Select images
  const selected = selectImages(manifest.images, chunks, MIN_WIDTH);
  console.log(`\nSelected ${selected.length} images (best per page with chunks, >= ${MIN_WIDTH}px wide)\n`);

  // Upload in batches
  const allUploaded: SelectedImage[] = [];
  const toUpload = selected.map(({ image }) => {
    const pdfBasename = image.sourcePdf.replace(".pdf", "");
    const storagePath = `${pdfBasename}/${image.filename}`;
    const filePath = path.join(IMAGES_DIR, image.path);
    return { image, filePath, storagePath };
  });

  // Verify files exist before uploading
  const validUploads = toUpload.filter(({ filePath }) => {
    if (!fs.existsSync(filePath)) {
      console.error(`  MISS file not found: ${filePath}`);
      return false;
    }
    return true;
  });

  console.log(`Uploading ${validUploads.length} images (${UPLOAD_CONCURRENCY} parallel)...\n`);

  for (let i = 0; i < validUploads.length; i += UPLOAD_CONCURRENCY) {
    const batch = validUploads.slice(i, i + UPLOAD_CONCURRENCY);
    const results = await uploadBatch(supabase, batch, chunks);
    allUploaded.push(...results);

    const progress = Math.min(i + UPLOAD_CONCURRENCY, validUploads.length);
    console.log(`  Progress: ${progress}/${validUploads.length} (${allUploaded.length} successful)`);

    if (i + UPLOAD_CONCURRENCY < validUploads.length) {
      await new Promise((resolve) => setTimeout(resolve, UPLOAD_BATCH_DELAY));
    }
  }

  console.log(`\nUploaded ${allUploaded.length}/${validUploads.length} images successfully.`);

  // Generate image-refs-map.json
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const imageRefsMap = buildImageRefsMap(allUploaded);
  fs.writeFileSync(IMAGE_REFS_MAP_PATH, JSON.stringify(imageRefsMap, null, 2));
  console.log(`\nWrote image refs map to ${IMAGE_REFS_MAP_PATH}`);
  console.log(`  ${Object.keys(imageRefsMap).length} page entries mapping to ${allUploaded.length} images`);

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Images selected: ${selected.length}`);
  console.log(`Images uploaded: ${allUploaded.length}`);
  console.log(`Image refs map entries: ${Object.keys(imageRefsMap).length}`);
  console.log("\nNext step: Run 'npm run seed-db:clear' to re-seed chunks with image_refs.");
}

// Only run main when executed directly (not imported by tests)
const isDirectExecution = process.argv[1]?.endsWith("seed-images.ts") ||
  process.argv[1]?.includes("seed-images");

if (isDirectExecution && !process.env.VITEST) {
  main().catch(console.error);
}
