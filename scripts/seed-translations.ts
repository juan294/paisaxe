/**
 * Seed story translations into the database.
 *
 * This script updates the metadata.translations field for all stories
 * that have translations defined in content/translations/story-translations.ts
 *
 * Usage:
 *   npx tsx scripts/seed-translations.ts
 *   npx tsx scripts/seed-translations.ts --dry-run  # Preview changes without writing
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { STORY_TRANSLATIONS } from '../content/translations/story-translations';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface StoryRow {
  id: string;
  slug: string;
  title: string;
  metadata: Record<string, unknown>;
}

async function seedTranslations(dryRun: boolean = false): Promise<void> {
  console.log('=== Story Translations Seeder ===\n');
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Fetch all stories
  const { data: stories, error: fetchError } = await supabase
    .from('stories')
    .select('id, slug, title, metadata');

  if (fetchError) {
    console.error('Error fetching stories:', fetchError.message);
    process.exit(1);
  }

  if (!stories || stories.length === 0) {
    console.log('No stories found in database.');
    return;
  }

  console.log(`Found ${stories.length} stories in database.`);
  console.log(`Found ${Object.keys(STORY_TRANSLATIONS).length} stories with translations.\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  // Track which translations were used
  const usedSlugs = new Set<string>();

  for (const story of stories as StoryRow[]) {
    const translations = STORY_TRANSLATIONS[story.slug];

    if (!translations) {
      skipped++;
      continue;
    }

    usedSlugs.add(story.slug);

    // Merge translations into existing metadata
    const updatedMetadata = {
      ...story.metadata,
      translations,
    };

    if (dryRun) {
      console.log(`Would update: ${story.title} (${story.slug})`);
      console.log(`  Languages: ${Object.keys(translations).join(', ')}`);
      updated++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('stories')
      .update({ metadata: updatedMetadata })
      .eq('id', story.id);

    if (updateError) {
      console.error(`Error updating ${story.slug}:`, updateError.message);
    } else {
      console.log(`✓ Updated: ${story.title} (${story.slug})`);
      updated++;
    }
  }

  // Check for translations that don't match any story
  for (const slug of Object.keys(STORY_TRANSLATIONS)) {
    if (!usedSlugs.has(slug)) {
      console.warn(`⚠ Translation exists but story not found: ${slug}`);
      notFound++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no translation): ${skipped}`);
  console.log(`Not found in DB: ${notFound}`);

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply changes.');
  }
}

// Main
const dryRun = process.argv.includes('--dry-run');
seedTranslations(dryRun).catch(console.error);
