import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function update() {
  // Update ALL active stories to use consistent "Fuente: Turismo Asturias"
  // The content (title, description, location) always comes from the tourism PDFs
  // regardless of whether the image is from the PDF, Unsplash, or a placeholder
  const { data: updated, error } = await supabase
    .from('stories')
    .update({ image_source: 'Fuente: Turismo Asturias' })
    .eq('is_active', true)
    .select('id');

  if (error) {
    console.error('Error updating sources:', error.message);
    return;
  }

  console.log('Updated stories:', updated?.length || 0);

  // Verify distribution
  const { data: final } = await supabase
    .from('stories')
    .select('image_source')
    .eq('is_active', true);

  const sources = new Map<string, number>();
  final?.forEach(s => {
    const src = s.image_source || '(null)';
    sources.set(src, (sources.get(src) || 0) + 1);
  });

  console.log('\nSource distribution:');
  sources.forEach((count, source) => {
    console.log(`  ${source}: ${count}`);
  });
}

update();
