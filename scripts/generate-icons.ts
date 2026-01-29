/**
 * Generate all favicon and PWA icons from the source SVG
 *
 * Usage: npx tsx scripts/generate-icons.ts
 */

import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const PUBLIC_DIR = join(process.cwd(), "public");
const SOURCE_SVG = join(PUBLIC_DIR, "icon.svg");

interface IconConfig {
  filename: string;
  size: number;
  padding?: number; // For maskable icons (percentage of size)
}

const ICONS: IconConfig[] = [
  // Standard icons
  { filename: "icon-192.png", size: 192 },
  { filename: "icon-512.png", size: 512 },
  { filename: "apple-touch-icon.png", size: 180 },

  // Maskable icons (with 10% safe zone padding)
  { filename: "icon-maskable-192.png", size: 192, padding: 0.1 },
  { filename: "icon-maskable-512.png", size: 512, padding: 0.1 },
];

async function generateIcon(svgBuffer: Buffer, config: IconConfig): Promise<void> {
  const outputPath = join(PUBLIC_DIR, config.filename);

  if (config.padding) {
    // For maskable icons, resize smaller and add padding
    const innerSize = Math.round(config.size * (1 - config.padding * 2));
    const padding = Math.round(config.size * config.padding);

    const resized = await sharp(svgBuffer)
      .resize(innerSize, innerSize, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
      .png()
      .toBuffer();

    // Add padding by extending the canvas
    await sharp(resized)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 10, g: 10, b: 10, alpha: 1 }, // #0a0a0a
      })
      .png()
      .toFile(outputPath);
  } else {
    // Standard icon, just resize
    await sharp(svgBuffer)
      .resize(config.size, config.size, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
      .png()
      .toFile(outputPath);
  }

  console.log(`✓ Generated ${config.filename} (${config.size}x${config.size})`);
}

async function generateFavicon(svgBuffer: Buffer): Promise<void> {
  // Generate a 32x32 PNG first
  const png32 = await sharp(svgBuffer)
    .resize(32, 32, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
    .png()
    .toBuffer();

  // For favicon.ico, we'll create a simple PNG version
  // Modern browsers support PNG favicons, and .ico is mainly for legacy IE
  const faviconPath = join(PUBLIC_DIR, "favicon.ico");

  // Sharp can't create .ico directly, but we can create a 32x32 PNG
  // that most browsers will accept. For true .ico, use a converter.
  await sharp(png32).toFile(faviconPath.replace(".ico", "-32.png"));

  // Also create a 16x16 version
  await sharp(svgBuffer)
    .resize(16, 16, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
    .png()
    .toFile(join(PUBLIC_DIR, "favicon-16.png"));

  console.log(`✓ Generated favicon-32.png and favicon-16.png`);
  console.log(`  Note: For true .ico format, combine these with an online converter`);
  console.log(`  Or use: brew install imagemagick && convert favicon-16.png favicon-32.png favicon.ico`);
}

async function main(): Promise<void> {
  console.log("Generating icons from", SOURCE_SVG);
  console.log("");

  const svgBuffer = readFileSync(SOURCE_SVG);

  // Generate all PNG icons
  for (const config of ICONS) {
    await generateIcon(svgBuffer, config);
  }

  // Generate favicon
  await generateFavicon(svgBuffer);

  console.log("");
  console.log("Done! Icons generated in /public/");
  console.log("");
  console.log("Next steps:");
  console.log("1. Replace public/icon.svg with your branded design if needed");
  console.log("2. Re-run this script to regenerate all icons");
  console.log("3. For favicon.ico, either:");
  console.log("   - Use favicon-32.png as-is (works in modern browsers)");
  console.log("   - Install ImageMagick and run: convert favicon-16.png favicon-32.png favicon.ico");
}

main().catch(console.error);
