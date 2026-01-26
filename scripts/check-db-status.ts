import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('stories')
    .select('id, title, image_path, category')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const total = data.length;
  const withImages = data.filter(s => s.image_path && s.image_path.length > 0).length;
  const withoutImages = total - withImages;

  console.log('=== Database Status ===');
  console.log('Total stories:', total);
  console.log('With images:', withImages);
  console.log('Without images:', withoutImages);
  
  if (withoutImages > 0) {
    console.log('\nStories missing images (first 10):');
    const missing = data.filter(s => !s.image_path || s.image_path.length === 0);
    missing.slice(0, 10).forEach(s => console.log('  -', s.title, '(' + s.category + ')'));
    if (missing.length > 10) {
      console.log('  ... and', missing.length - 10, 'more');
    }
  }
}

check();
