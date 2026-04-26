/**
 * compress-images.ts
 *
 * Re-encodes all WebP files in public/images/stories/ at quality 78 and
 * resizes any image wider than 2560px to fit within that bound (aspect ratio
 * preserved).  Overwrites the originals in place.
 *
 * Usage:
 *   npx tsx scripts/compress-images.ts
 */

import sharp from 'sharp';
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const STORIES_DIR = join(process.cwd(), 'public', 'images', 'stories');
const MAX_WIDTH = 1280;
const QUALITY = 75;

async function compressImage(filePath: string): Promise<{ before: number; after: number }> {
  const before = statSync(filePath).size;

  const image = sharp(filePath);
  const meta = await image.metadata();

  const pipeline =
    meta.width && meta.width > MAX_WIDTH
      ? image.resize({ width: MAX_WIDTH, withoutEnlargement: true })
      : image;

  const buffer = await pipeline.webp({ quality: QUALITY }).toBuffer();

  // Write atomically: sharp can read from + write to the same path via buffer
  await sharp(buffer).toFile(filePath);

  const after = statSync(filePath).size;
  return { before, after };
}

async function main(): Promise<void> {
  const files = readdirSync(STORIES_DIR).filter(
    (f) => extname(f).toLowerCase() === '.webp',
  );

  if (files.length === 0) {
    console.log('No WebP files found in', STORIES_DIR);
    return;
  }

  console.log(`Processing ${files.length} WebP files in ${STORIES_DIR}…\n`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const filePath = join(STORIES_DIR, file);
    const { before, after } = await compressImage(filePath);
    const saving = (((before - after) / before) * 100).toFixed(1);
    console.log(
      `  ${file.padEnd(55)} ${(before / 1024).toFixed(0).padStart(5)}KB → ${(after / 1024).toFixed(0).padStart(5)}KB  (${saving}% smaller)`,
    );
    totalBefore += before;
    totalAfter += after;
  }

  const totalSaving = (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1);
  console.log(
    `\nTotal: ${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024 / 1024).toFixed(2)} MB  (${totalSaving}% smaller)`,
  );
}

main().catch((err: unknown) => {
  console.error('Compression failed:', err);
  process.exit(1);
});
