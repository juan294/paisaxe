/**
 * Assign placeholder images to existing stories in the database
 * that have no image OR have old-style Unsplash placeholder URLs.
 *
 * Usage:
 *   npx tsx scripts/assign-placeholder-images.ts
 *   npx tsx scripts/assign-placeholder-images.ts --dry-run
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getPlaceholderForStory, PLACEHOLDER_PREFIX } from "../src/lib/unsplash-placeholders";
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

  // Fetch stories with no image OR old-style Unsplash URLs without the new prefix
  const { data: allStories, error } = await supabase
    .from("stories")
    .select("id, slug, title, category, image_path, image_source")
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching stories:", error.message);
    process.exit(1);
  }

  // Filter: no image, or Unsplash URL without the new placeholder prefix
  const stories = (allStories || []).filter((s) => {
    if (!s.image_path) return true;
    const isUnsplash = s.image_path.startsWith("https://images.unsplash.com/");
    const hasNewPrefix = s.image_source?.startsWith(PLACEHOLDER_PREFIX);
    return isUnsplash && !hasNewPrefix;
  });

  if (stories.length === 0) {
    console.log("All stories already have proper images. Nothing to do.");
    return;
  }

  console.log(`Found ${stories.length} stories needing placeholder replacement:\n`);

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
