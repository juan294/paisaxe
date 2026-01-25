import fs from "fs";
import path from "path";
import { createCanvas } from "canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// Configure pdf.js to work in Node.js environment
const PDFJS_WORKER_PATH = path.join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.mjs"
);

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_PATH;

interface ExtractedImage {
  filename: string;
  sourcePdf: string;
  pageNumber: number;
  width: number;
  height: number;
  path: string;
}

interface ImageManifest {
  extractedAt: string;
  totalImages: number;
  totalPdfs: number;
  images: ExtractedImage[];
}

const PDF_DIR = path.join(process.cwd(), "content", "pdfs");
const IMAGES_DIR = path.join(process.cwd(), "content", "images");
const MANIFEST_FILE = path.join(IMAGES_DIR, "manifest.json");

// Minimum dimensions to filter out tiny images/icons
const MIN_IMAGE_WIDTH = 100;
const MIN_IMAGE_HEIGHT = 100;

interface PDFImageData {
  width: number;
  height: number;
  data?: Uint8Array | Uint8ClampedArray;
}

async function extractImagesFromPage(
  page: pdfjs.PDFPageProxy,
  pageNumber: number,
  pdfName: string,
  outputDir: string
): Promise<ExtractedImage[]> {
  const extractedImages: ExtractedImage[] = [];

  try {
    const operatorList = await page.getOperatorList();
    const commonObjs = page.commonObjs;
    const objs = page.objs;

    const imageOperatorTypes = [
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageMaskXObject,
    ];

    let imageIndex = 0;

    for (let i = 0; i < operatorList.fnArray.length; i++) {
      const op = operatorList.fnArray[i];

      if (imageOperatorTypes.includes(op)) {
        const args = operatorList.argsArray[i];
        const imageName = args[0];

        let imageData: PDFImageData | null = null;

        try {
          // Try to get image from page objects first
          if (objs.has(imageName)) {
            imageData = objs.get(imageName) as PDFImageData;
          } else if (commonObjs.has(imageName)) {
            imageData = commonObjs.get(imageName) as PDFImageData;
          }

          if (imageData && "width" in imageData && "height" in imageData) {
            const width = imageData.width;
            const height = imageData.height;

            // Skip tiny images
            if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
              continue;
            }

            // Create canvas and draw image
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext("2d");

            // Convert image data to ImageData format
            if ("data" in imageData && imageData.data) {
              const imgData = ctx.createImageData(width, height);

              // Handle different image data formats
              if (imageData.data.length === width * height * 4) {
                // RGBA format
                imgData.data.set(new Uint8ClampedArray(imageData.data));
              } else if (imageData.data.length === width * height * 3) {
                // RGB format - convert to RGBA
                const rgb = imageData.data;
                for (let j = 0; j < width * height; j++) {
                  imgData.data[j * 4] = rgb[j * 3];
                  imgData.data[j * 4 + 1] = rgb[j * 3 + 1];
                  imgData.data[j * 4 + 2] = rgb[j * 3 + 2];
                  imgData.data[j * 4 + 3] = 255;
                }
              } else if (imageData.data.length === width * height) {
                // Grayscale - convert to RGBA
                const gray = imageData.data;
                for (let j = 0; j < width * height; j++) {
                  imgData.data[j * 4] = gray[j];
                  imgData.data[j * 4 + 1] = gray[j];
                  imgData.data[j * 4 + 2] = gray[j];
                  imgData.data[j * 4 + 3] = 255;
                }
              } else {
                continue; // Unknown format
              }

              ctx.putImageData(imgData, 0, 0);

              // Generate filename
              const filename = `${pdfName}_page${pageNumber}_img${imageIndex}.png`;
              const imagePath = path.join(outputDir, filename);

              // Save image
              const buffer = canvas.toBuffer("image/png");
              fs.writeFileSync(imagePath, buffer);

              extractedImages.push({
                filename,
                sourcePdf: `${pdfName}.pdf`,
                pageNumber,
                width,
                height,
                path: path.relative(IMAGES_DIR, imagePath),
              });

              imageIndex++;
            }
          }
        } catch {
          // Skip images that fail to extract
          continue;
        }
      }
    }
  } catch (error) {
    console.error(`  Error extracting images from page ${pageNumber}:`, error);
  }

  return extractedImages;
}

async function extractImagesFromPdf(filePath: string): Promise<ExtractedImage[]> {
  const filename = path.basename(filePath, ".pdf");
  console.log(`\nProcessing: ${filename}.pdf`);

  const extractedImages: ExtractedImage[] = [];

  try {
    // Create output directory for this PDF
    const outputDir = path.join(IMAGES_DIR, filename);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Load PDF
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    console.log(`  Total pages: ${numPages}`);

    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const pageImages = await extractImagesFromPage(page, pageNum, filename, outputDir);
        extractedImages.push(...pageImages);
        page.cleanup();
      } catch {
        console.warn(`  Warning: Could not process page ${pageNum}`);
      }
    }

    // Clean up empty directories
    if (extractedImages.length === 0 && fs.existsSync(outputDir)) {
      fs.rmdirSync(outputDir);
    }

    console.log(`  Extracted: ${extractedImages.length} images`);
  } catch (error) {
    console.error(`  Error processing PDF:`, error);
  }

  return extractedImages;
}

async function renderPageAsImage(
  filePath: string,
  pageNum: number,
  outputDir: string,
  pdfName: string,
  scale: number = 2.0
): Promise<ExtractedImage | null> {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNum);

    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const filename = `${pdfName}_page${pageNum}_full.png`;
    const imagePath = path.join(outputDir, filename);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(imagePath, buffer);

    page.cleanup();

    return {
      filename,
      sourcePdf: `${pdfName}.pdf`,
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      path: path.relative(IMAGES_DIR, imagePath),
    };
  } catch {
    return null;
  }
}

async function extractPageRendersFromPdf(filePath: string): Promise<ExtractedImage[]> {
  const filename = path.basename(filePath, ".pdf");
  console.log(`\nRendering pages from: ${filename}.pdf`);

  const extractedImages: ExtractedImage[] = [];

  try {
    const outputDir = path.join(IMAGES_DIR, filename);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    console.log(`  Total pages: ${numPages}`);

    // Render first 3 pages as sample images (or all pages if less than 3)
    const pagesToRender = Math.min(numPages, 3);

    for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
      const image = await renderPageAsImage(filePath, pageNum, outputDir, filename);
      if (image) {
        extractedImages.push(image);
      }
    }

    console.log(`  Rendered: ${extractedImages.length} page images`);
  } catch (error) {
    console.error(`  Error rendering PDF pages:`, error);
  }

  return extractedImages;
}

async function processAllPdfs(mode: "extract" | "render" | "both" = "both"): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  const files = fs.readdirSync(PDF_DIR).filter((f) => f.endsWith(".pdf"));
  console.log(`Found ${files.length} PDF files to process`);
  console.log(`Mode: ${mode}`);

  const allImages: ExtractedImage[] = [];

  for (const file of files) {
    const filePath = path.join(PDF_DIR, file);

    if (mode === "extract" || mode === "both") {
      const extracted = await extractImagesFromPdf(filePath);
      allImages.push(...extracted);
    }

    if (mode === "render" || mode === "both") {
      const rendered = await extractPageRendersFromPdf(filePath);
      allImages.push(...rendered);
    }
  }

  // Create manifest
  const manifest: ImageManifest = {
    extractedAt: new Date().toISOString(),
    totalImages: allImages.length,
    totalPdfs: files.length,
    images: allImages,
  };

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  console.log(`\n=== Image Extraction Complete ===`);
  console.log(`Total images extracted: ${allImages.length}`);
  console.log(`Manifest saved to: ${MANIFEST_FILE}`);
}

// Run the script
const args = process.argv.slice(2);
const mode = args.includes("--render")
  ? "render"
  : args.includes("--extract")
    ? "extract"
    : "both";

processAllPdfs(mode).catch(console.error);
