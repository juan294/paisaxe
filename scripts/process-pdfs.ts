import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";

interface ExtractedChunk {
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

async function extractTextFromPdf(filePath: string): Promise<ProcessedPdf> {
  const filename = path.basename(filePath);
  console.log(`Processing: ${filename}`);

  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  const chunks: ExtractedChunk[] = [];
  const text = data.text;

  // Split by double newlines to get paragraphs/sections
  const sections = text.split(/\n{2,}/);

  let currentPage = 1;
  let currentSection = "";
  let currentContent = "";

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Detect section headers (typically short, uppercase or title case)
    const isHeader =
      trimmed.length < 100 &&
      (trimmed === trimmed.toUpperCase() ||
        /^[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s,]+$/.test(trimmed));

    if (isHeader) {
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
      if (currentContent.length > 1500) {
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

  return {
    filename,
    chunks,
    totalPages: data.numpages,
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

// Run the script
processAllPdfs().catch(console.error);
