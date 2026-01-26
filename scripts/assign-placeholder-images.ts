/**
 * Assign placeholder images to existing stories in the database
 * that currently have no image.
 *
 * Usage:
 *   npx tsx scripts/assign-placeholder-images.ts
 *   npx tsx scripts/assign-placeholder-images.ts --dry-run
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getPlaceholderForStory } from "../src/lib/unsplash-placeholders";
import type { StoryCategory } from "../src/types/immersive";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  if (!supabaseUrl) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceKey) console.error("  - SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=== Assign Placeholder Images ===\n");
  if (dryRun) {
    console.log("(dry run — no changes will be written)\n");
  }

  // Fetch stories with no image
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, slug, title, category, image_path, image_source")
    .or("image_path.is.null,image_path.eq.")
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching stories:", error.message);
    process.exit(1);
  }

  if (!stories || stories.length === 0) {
    console.log("All stories already have images. Nothing to do.");
    return;
  }

  console.log(`Found ${stories.length} stories without images:\n`);

  let updated = 0;
  for (const story of stories) {
    const placeholder = getPlaceholderForStory(
      story.slug,
      story.category as StoryCategory
    );

    console.log(`  ${story.title}`);
    console.log(`    slug: ${story.slug}`);
    console.log(`    image: ${placeholder.image}`);
    console.log(`    source: ${placeholder.imageSource}\n`);

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("stories")
        .update({
          image_path: placeholder.image,
          image_source: placeholder.imageSource,
        })
        .eq("id", story.id);

      if (updateError) {
        console.error(`  Error updating "${story.title}":`, updateError.message);
      } else {
        updated++;
      }
    }
  }

  if (dryRun) {
    console.log(`Would update ${stories.length} stories. Run without --dry-run to apply.`);
  } else {
    console.log(`Updated ${updated}/${stories.length} stories.`);
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
