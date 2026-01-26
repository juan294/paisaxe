/**
 * Script to map stories to extracted PDF images
 *
 * This script:
 * 1. Fetches all stories from the database
 * 2. Reads the image manifest
 * 3. Finds the best hero image for each story based on its source PDF
 * 4. Copies images to public/images/stories/
 * 5. Updates the database with new image paths
 */

import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ManifestImage {
  filename: string;
  sourcePdf: string;
  pageNumber: number;
  width: number;
  height: number;
  path: string;
}

interface Manifest {
  extractedAt: string;
  totalImages: number;
  totalPdfs: number;
  images: ManifestImage[];
}

interface Story {
  id: string;
  slug: string;
  title: string;
  source_pdf: string | null;
  image_path: string | null;
}

const CONTENT_DIR = path.join(process.cwd(), "content");
const IMAGES_DIR = path.join(CONTENT_DIR, "images");
const PUBLIC_DIR = path.join(process.cwd(), "public", "images", "stories");
const MANIFEST_PATH = path.join(IMAGES_DIR, "manifest.json");

function findBestImageForPdf(images: ManifestImage[], sourcePdf: string, usedImages: Set<string>): ManifestImage | null {
  // Try with exact PDF name first
  let pdfImages = images.filter(img => img.sourcePdf === sourcePdf && !usedImages.has(img.path));

  // If no match, try without extension
  if (pdfImages.length === 0) {
    const pdfBaseName = sourcePdf.replace('.pdf', '');
    pdfImages = images.filter(img => {
      const imgBaseName = img.sourcePdf.replace('.pdf', '');
      return imgBaseName === pdfBaseName && !usedImages.has(img.path);
    });
  }

  if (pdfImages.length === 0) {
    return null;
  }

  // Prefer landscape images (width > height) with good resolution
  const landscapeImages = pdfImages.filter(img => img.width > img.height && img.width >= 600);

  if (landscapeImages.length > 0) {
    // Sort by area (width * height) descending, prefer earlier pages for covers
    return landscapeImages.sort((a, b) => {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      if (areaA !== areaB) return areaB - areaA;
      return a.pageNumber - b.pageNumber;
    })[0];
  }

  // Fallback to largest image regardless of orientation
  return pdfImages.sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    return areaB - areaA;
  })[0];
}

async function main() {
  console.log("=== Story Image Mapper ===\n");

  // Fetch all stories from database
  const { data: stories, error } = await supabase
    .from('stories')
    .select('id, slug, title, source_pdf, image_path')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error("Error fetching stories:", error.message);
    process.exit(1);
  }

  console.log(`Fetched ${stories.length} stories from database\n`);

  // Read manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("Manifest not found at", MANIFEST_PATH);
    console.log("Run 'npm run extract-images' first to extract images from PDFs");
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  console.log(`Loaded manifest: ${manifest.totalImages} images from ${manifest.totalPdfs} PDFs\n`);

  // Ensure output directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    console.log(`Created directory: ${PUBLIC_DIR}\n`);
  }

  const usedImages = new Set<string>();
  let pdfImagesUsed = 0;
  let alreadyHaveImage = 0;
  let noSourcePdf = 0;
  let noImagesFound = 0;
  const updates: { id: string; image_path: string }[] = [];

  // First pass: mark images already in use
  for (const story of stories) {
    if (story.image_path && story.image_path.startsWith('/images/stories/')) {
      // Mark as used if it's a local PDF-extracted image
      const filename = story.image_path.split('/').pop();
      if (filename) {
        // Try to find the original image in manifest
        const matchingImage = manifest.images.find(img =>
          img.path.includes(filename.replace('.png', ''))
        );
        if (matchingImage) {
          usedImages.add(matchingImage.path);
        }
      }
    }
  }

  for (const story of stories as Story[]) {
    // Skip stories that already have an image
    if (story.image_path && story.image_path.length > 0) {
      alreadyHaveImage++;
      continue;
    }

    // Skip stories without a source PDF
    if (!story.source_pdf) {
      noSourcePdf++;
      console.log(`⚠ ${story.slug}: No source PDF`);
      continue;
    }

    // Find best image for this story's PDF
    const bestImage = findBestImageForPdf(manifest.images, story.source_pdf, usedImages);

    if (bestImage) {
      // Copy image to public directory
      const sourcePath = path.join(IMAGES_DIR, bestImage.path);
      const destFilename = `${story.slug}.png`;
      const destPath = path.join(PUBLIC_DIR, destFilename);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        usedImages.add(bestImage.path);

        const newImagePath = `/images/stories/${destFilename}`;
        updates.push({ id: story.id, image_path: newImagePath });
        pdfImagesUsed++;
        console.log(`✓ ${story.slug}: Using PDF image (${bestImage.width}x${bestImage.height})`);
      } else {
        noImagesFound++;
        console.log(`⚠ ${story.slug}: Source file not found at ${sourcePath}`);
      }
    } else {
      noImagesFound++;
      console.log(`⚠ ${story.slug}: No suitable images in ${story.source_pdf}`);
    }
  }

  // Update database with new image paths
  if (updates.length > 0) {
    console.log(`\nUpdating ${updates.length} stories in database...`);

    let updateSuccess = 0;
    let updateFailed = 0;

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('stories')
        .update({ image_path: update.image_path })
        .eq('id', update.id);

      if (updateError) {
        console.error(`Failed to update ${update.id}:`, updateError.message);
        updateFailed++;
      } else {
        updateSuccess++;
      }
    }

    console.log(`Database updates: ${updateSuccess} successful, ${updateFailed} failed`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total stories: ${stories.length}`);
  console.log(`Already had images: ${alreadyHaveImage}`);
  console.log(`New images assigned: ${pdfImagesUsed}`);
  console.log(`No source PDF: ${noSourcePdf}`);
  console.log(`No suitable images found: ${noImagesFound}`);
}

main().catch(console.error);
