/**
 * Script to map stories to extracted PDF images
 *
 * This script:
 * 1. Reads the image manifest
 * 2. Finds the best hero image for each story based on its source PDF
 * 3. Copies images to public/images/stories/
 * 4. Outputs the updated story image mappings
 */

import fs from "fs";
import path from "path";

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

interface StoryImageMapping {
  storyId: string;
  sourcePdf: string;
  originalImage: string;
  newImage: string | null;
  source: "pdf" | "unsplash";
}

// Stories with their source PDFs and current Unsplash URLs
const STORIES = [
  { id: "lagos-covadonga", sourcePdf: "0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf", unsplash: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920" },
  { id: "oviedo-catedral", sourcePdf: "Asturias-en-familia-ES.pdf", unsplash: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920" },
  { id: "fabada", sourcePdf: "Asturias-en-familia-ES.pdf", unsplash: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1920" },
  { id: "prerromanico", sourcePdf: "02e93c24-6cac-6d7d-1ca8-59fd8d3fa337.pdf", unsplash: "https://images.unsplash.com/photo-1568797629192-789acf8e4df3?w=1920" },
  { id: "ruta-cares", sourcePdf: "0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf", unsplash: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920" },
  { id: "playa-silencio", sourcePdf: "12c86611-ccbe-dbe9-ac86-67ef948a5371.pdf", unsplash: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920" },
  { id: "sidra", sourcePdf: "Asturias-en-familia-ES.pdf", unsplash: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1920" },
  { id: "gijon", sourcePdf: "Asturias-en-familia-ES.pdf", unsplash: "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=1920" },
  { id: "aviles", sourcePdf: "Guia-visitar-Aviles-ES.pdf", unsplash: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1920" },
  { id: "camino-santiago", sourcePdf: "Planificador-Camino-ES.pdf", unsplash: "https://images.unsplash.com/photo-1541623089466-8e777dd05db2?w=1920" },
  { id: "llanes", sourcePdf: "Cuento-de-Asturias-ES.pdf", unsplash: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1920" },
  { id: "cangas-onis", sourcePdf: "Guia-cultura-ES.pdf", unsplash: "https://images.unsplash.com/photo-1464278533981-50106e6176b1?w=1920" },
  { id: "descenso-sella", sourcePdf: "Asturias-en-familia-ES.pdf", unsplash: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1920" },
  { id: "quesos-asturianos", sourcePdf: "Guia-cultura-ES.pdf", unsplash: "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=1920" },
  { id: "museo-jurrasico", sourcePdf: "Asturias-en-familia-ES.pdf", unsplash: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920" },
  { id: "senda-oso", sourcePdf: "Asturias-en-familia-ES.pdf", unsplash: "https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=1920" },
  { id: "cudillero", sourcePdf: "Cuento-de-Asturias-ES.pdf", unsplash: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?w=1920" },
  { id: "taramundi", sourcePdf: "Cuento-de-Asturias-ES.pdf", unsplash: "https://images.unsplash.com/photo-1500049242364-5f500807cdd7?w=1920" },
  { id: "bufones-pria", sourcePdf: "Cuento-de-Asturias-ES.pdf", unsplash: "https://images.unsplash.com/photo-1509233725247-49e657c54213?w=1920" },
  { id: "luarca", sourcePdf: "Cuento-de-Asturias-ES.pdf", unsplash: "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1920" },
];

const CONTENT_DIR = path.join(process.cwd(), "content");
const IMAGES_DIR = path.join(CONTENT_DIR, "images");
const PUBLIC_DIR = path.join(process.cwd(), "public", "images", "stories");
const MANIFEST_PATH = path.join(IMAGES_DIR, "manifest.json");

function findBestImageForPdf(images: ManifestImage[], sourcePdf: string): ManifestImage | null {
  const pdfImages = images.filter(img => img.sourcePdf === sourcePdf);

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

  // Read manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("Manifest not found at", MANIFEST_PATH);
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  console.log(`Loaded manifest: ${manifest.totalImages} images from ${manifest.totalPdfs} PDFs\n`);

  // Ensure output directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    console.log(`Created directory: ${PUBLIC_DIR}\n`);
  }

  const mappings: StoryImageMapping[] = [];
  const usedImages = new Set<string>();
  let pdfImagesUsed = 0;
  let unsplashFallbacks = 0;

  for (const story of STORIES) {
    // Find best image for this story's PDF
    // Filter out already used images to get variety
    const availableImages = manifest.images.filter(img => !usedImages.has(img.path));
    const bestImage = findBestImageForPdf(availableImages, story.sourcePdf);

    if (bestImage) {
      // Copy image to public directory
      const sourcePath = path.join(IMAGES_DIR, bestImage.path);
      const destFilename = `${story.id}.png`;
      const destPath = path.join(PUBLIC_DIR, destFilename);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        usedImages.add(bestImage.path);

        mappings.push({
          storyId: story.id,
          sourcePdf: story.sourcePdf,
          originalImage: story.unsplash,
          newImage: `/images/stories/${destFilename}`,
          source: "pdf",
        });
        pdfImagesUsed++;
        console.log(`✓ ${story.id}: Using PDF image (${bestImage.width}x${bestImage.height})`);
      } else {
        mappings.push({
          storyId: story.id,
          sourcePdf: story.sourcePdf,
          originalImage: story.unsplash,
          newImage: null,
          source: "unsplash",
        });
        unsplashFallbacks++;
        console.log(`⚠ ${story.id}: Source file not found, using Unsplash`);
      }
    } else {
      mappings.push({
        storyId: story.id,
        sourcePdf: story.sourcePdf,
        originalImage: story.unsplash,
        newImage: null,
        source: "unsplash",
      });
      unsplashFallbacks++;
      console.log(`⚠ ${story.id}: No images in ${story.sourcePdf}, using Unsplash`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`PDF images used: ${pdfImagesUsed}`);
  console.log(`Unsplash fallbacks: ${unsplashFallbacks}`);

  // Output the mappings for updating the seed script
  console.log(`\n=== Image Mappings for seed-database.ts ===\n`);
  console.log("const STORY_IMAGES: Record<string, string> = {");
  for (const mapping of mappings) {
    const imageUrl = mapping.newImage || mapping.originalImage;
    console.log(`  "${mapping.storyId}": "${imageUrl}",`);
  }
  console.log("};");

  // Write mappings to JSON file for reference
  const mappingsPath = path.join(CONTENT_DIR, "story-image-mappings.json");
  fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2));
  console.log(`\nMappings saved to ${mappingsPath}`);
}

main().catch(console.error);
