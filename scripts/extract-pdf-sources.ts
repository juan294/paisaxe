import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const PDF_DIR = path.join(process.cwd(), "content", "pdfs");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Common Asturias tourism URLs to look for
const URL_PATTERNS = [
  /turismoasturias\.es/gi,
  /asturiasciclismopornaturaleza\.com/gi,
  /asturias\.es/gi,
  /descubreasturias\.com/gi,
  /infoasturias\.com/gi,
  /www\.[a-z0-9-]+\.(es|com|org)/gi,
];

interface PdfSource {
  filename: string;
  source: string | null;
  rawText?: string;
}

async function extractSourceFromPdf(filePath: string): Promise<PdfSource> {
  const filename = path.basename(filePath);

  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    const text = data.text;
    const totalPages = data.numpages;

    // Split text roughly by pages (approximate since pdf-parse combines all text)
    const textLength = text.length;
    const firstPageText = text.substring(0, Math.min(2000, textLength / totalPages * 2));
    const lastPageText = text.substring(Math.max(0, textLength - 2000));

    // Search for URLs in first and last pages
    const searchText = firstPageText + " " + lastPageText;

    let foundSource: string | null = null;

    // Look for specific tourism URLs first
    for (const pattern of URL_PATTERNS) {
      const matches = searchText.match(pattern);
      if (matches && matches.length > 0) {
        // Clean up the match
        foundSource = matches[0].toLowerCase();
        // Prioritize turismoasturias.es
        if (foundSource.includes("turismoasturias")) {
          foundSource = "turismoasturias.es";
          break;
        }
        if (foundSource.includes("asturiasciclismo")) {
          foundSource = "asturiasciclismopornaturaleza.com";
          break;
        }
      }
    }

    // Default to turismoasturias.es for official Asturias PDFs
    if (!foundSource && (text.includes("Asturias") || text.includes("paraíso natural"))) {
      foundSource = "turismoasturias.es";
    }

    return {
      filename,
      source: foundSource,
    };
  } catch (error) {
    console.error(`Error processing ${filename}:`, error);
    return {
      filename,
      source: null,
    };
  }
}

async function updateStorySources(): Promise<void> {
  console.log("Extracting sources from PDFs...\n");

  const files = fs.readdirSync(PDF_DIR).filter((f) => f.endsWith(".pdf"));
  console.log(`Found ${files.length} PDF files\n`);

  // Extract sources from all PDFs
  const pdfSources: Map<string, string> = new Map();

  for (const file of files) {
    const filePath = path.join(PDF_DIR, file);
    const result = await extractSourceFromPdf(filePath);

    if (result.source) {
      pdfSources.set(result.filename, result.source);
      console.log(`✓ ${result.filename} -> ${result.source}`);
    } else {
      console.log(`? ${result.filename} -> No source found (will use default)`);
      // Default to turismoasturias.es for all Asturias tourism PDFs
      pdfSources.set(result.filename, "turismoasturias.es");
    }
  }

  console.log("\n--- Updating stories in database ---\n");

  // Get all stories
  const { data: stories, error: fetchError } = await supabase
    .from("stories")
    .select("id, title, source_pdf, image_source");

  if (fetchError) {
    console.error("Error fetching stories:", fetchError);
    return;
  }

  if (!stories || stories.length === 0) {
    console.log("No stories found in database");
    return;
  }

  console.log(`Found ${stories.length} stories\n`);

  let updated = 0;
  let skipped = 0;

  for (const story of stories) {
    // Skip if already has a source
    if (story.image_source) {
      console.log(`⏭ "${story.title}" - already has source: ${story.image_source}`);
      skipped++;
      continue;
    }

    // Find source from PDF
    let source = "turismoasturias.es"; // Default

    if (story.source_pdf) {
      const pdfSource = pdfSources.get(story.source_pdf);
      if (pdfSource) {
        source = pdfSource;
      }
    }

    // Format the source nicely
    const formattedSource = `Fuente: ${source}`;

    // Update the story
    const { error: updateError } = await supabase
      .from("stories")
      .update({ image_source: formattedSource })
      .eq("id", story.id);

    if (updateError) {
      console.error(`✗ Error updating "${story.title}":`, updateError);
    } else {
      console.log(`✓ "${story.title}" -> ${formattedSource}`);
      updated++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already had source): ${skipped}`);
  console.log(`Total: ${stories.length}`);
}

// Run the script
updateStorySources().catch(console.error);
