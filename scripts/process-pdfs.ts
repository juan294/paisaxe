import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

export interface ExtractedChunk {
  content: string;
  sourcePdf: string;
  pageNumber: number;
  sectionTitle?: string;
}

interface ProcessedPdf {
  filename: string;
  chunks: ExtractedChunk[];
  totalPages: number;
}

const PDF_DIR = path.join(process.cwd(), "content", "pdfs");
const OUTPUT_DIR = path.join(process.cwd(), "content", "processed");

/**
 * Detect whether a trimmed text block is a section header.
 * Headers are short (< 100 chars), ALL-CAPS, or Title Case Spanish text.
 */
export function isSectionHeader(text: string): boolean {
  if (!text || text.length >= 100) return false;
  return (
    text === text.toUpperCase() ||
    /^[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s,]+$/.test(text)
  );
}

/**
 * Convert raw extracted text into structured chunks.
 * Pure function — no I/O, no side effects.
 *
 * @param text      Full extracted text from a PDF
 * @param filename  Source PDF filename used to populate chunk.sourcePdf
 * @param maxChunkLength  Flush content to a new chunk when it exceeds this length (default 1500)
 */
export function chunkText(
  text: string,
  filename: string,
  maxChunkLength = 1500,
): ExtractedChunk[] {
  const chunks: ExtractedChunk[] = [];
  const sections = text.split(/\n{2,}/);

  let currentPage = 1;
  let currentSection = "";
  let currentContent = "";

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (isSectionHeader(trimmed)) {
      // Save previous content as a chunk
      if (currentContent.trim().length > 50) {
        chunks.push({
          content: currentContent.trim(),
          sourcePdf: filename,
          pageNumber: currentPage,
          sectionTitle: currentSection || undefined,
        });
      }
      currentSection = trimmed;
      currentContent = "";
    } else {
      currentContent += trimmed + "\n\n";

      // Create chunk if content is getting long
      if (currentContent.length > maxChunkLength) {
        chunks.push({
          content: currentContent.trim(),
          sourcePdf: filename,
          pageNumber: currentPage,
          sectionTitle: currentSection || undefined,
        });
        currentContent = "";
      }
    }

    // Estimate page number based on content position
    // This is approximate - proper page detection would need more sophisticated parsing
    if (section.includes("\f") || section.includes("Guía")) {
      currentPage++;
    }
  }

  // Don't forget the last chunk
  if (currentContent.trim().length > 50) {
    chunks.push({
      content: currentContent.trim(),
      sourcePdf: filename,
      pageNumber: currentPage,
      sectionTitle: currentSection || undefined,
    });
  }

  return chunks;
}

async function extractTextFromPdf(filePath: string): Promise<ProcessedPdf> {
  const filename = path.basename(filePath);
  console.log(`Processing: ${filename}`);

  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const data = await parser.getText();
  await parser.destroy();

  const chunks = chunkText(data.text, filename);

  return {
    filename,
    chunks,
    totalPages: data.total,
  };
}

async function processAllPdfs(): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(PDF_DIR).filter((f) => f.endsWith(".pdf"));
  console.log(`Found ${files.length} PDF files to process`);

  const allChunks: ExtractedChunk[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(PDF_DIR, file);
      const result = await extractTextFromPdf(filePath);
      allChunks.push(...result.chunks);
      console.log(`  -> Extracted ${result.chunks.length} chunks from ${result.totalPages} pages`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  // Save all chunks to JSON
  const outputPath = path.join(OUTPUT_DIR, "chunks.json");
  fs.writeFileSync(outputPath, JSON.stringify(allChunks, null, 2));

  console.log(`\nTotal chunks extracted: ${allChunks.length}`);
  console.log(`Output saved to: ${outputPath}`);
}

// Run the script only when invoked directly (not when imported by tests)
const isDirectExecution =
  process.argv[1]?.endsWith("process-pdfs.ts") ||
  process.argv[1]?.endsWith("process-pdfs.js");

if (isDirectExecution) {
  processAllPdfs().catch(console.error);
}
