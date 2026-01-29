# Icon Generation Guide

The Paisaxe marketing implementation requires several icon files for proper PWA support and favicon display.

## Required Icons

Generate the following PNG files from `public/icon.svg` or a custom brand design:

| File | Size | Purpose |
|------|------|---------|
| `public/favicon.ico` | 32x32 | Browser tab icon (legacy format) |
| `public/icon-192.png` | 192x192 | PWA icon (standard) |
| `public/icon-512.png` | 512x512 | PWA icon (high-res) |
| `public/icon-maskable-192.png` | 192x192 | PWA maskable icon (with safe zone) |
| `public/icon-maskable-512.png` | 512x512 | PWA maskable icon (with safe zone) |
| `public/apple-touch-icon.png` | 180x180 | iOS home screen icon |

## Current Status

- `public/icon.svg` - Vector icon created (placeholder design)
- PNG files need to be generated from the SVG

## Generation Options

### Option 1: Use an online tool
1. Upload `icon.svg` to a tool like [RealFaviconGenerator](https://realfavicongenerator.net/)
2. Download and extract the generated icons to `/public`

### Option 2: Use ImageMagick (CLI)
```bash
# Install ImageMagick if needed
brew install imagemagick

# Generate PNGs from SVG
cd public
convert -background none icon.svg -resize 192x192 icon-192.png
convert -background none icon.svg -resize 512x512 icon-512.png
convert -background none icon.svg -resize 180x180 apple-touch-icon.png
convert -background none icon.svg -resize 32x32 favicon.ico

# For maskable icons, add padding (10% safe zone)
convert -background none icon.svg -resize 154x154 -gravity center -extent 192x192 icon-maskable-192.png
convert -background none icon.svg -resize 410x410 -gravity center -extent 512x512 icon-maskable-512.png
```

### Option 3: Use sharp (Node.js)
```javascript
const sharp = require('sharp');

async function generateIcons() {
  const input = 'public/icon.svg';

  await sharp(input).resize(192, 192).png().toFile('public/icon-192.png');
  await sharp(input).resize(512, 512).png().toFile('public/icon-512.png');
  await sharp(input).resize(180, 180).png().toFile('public/apple-touch-icon.png');
  await sharp(input).resize(32, 32).png().toFile('public/favicon.ico');
}
```

## Maskable Icons

Maskable icons require a "safe zone" - the important content should be within the inner 80% of the icon. The outer 10% on each side may be cropped on some devices.

For the maskable versions, ensure the main icon content stays within the center safe area.

## Brand Customization

Replace `public/icon.svg` with your branded design before generating the PNG files. The current SVG is a placeholder showing stylized mountains (representing the Asturian landscape).

## Verification

After generating icons, verify they appear correctly:
1. Check browser tab shows favicon
2. Test "Add to Home Screen" on mobile
3. Use Chrome DevTools > Application > Manifest to verify PWA icons
