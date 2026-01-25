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
    .select('id, title, image_path, image_source')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const withSource = data.filter(s => s.image_source && s.image_source.length > 0);
  const withoutSource = data.filter(s => !s.image_source || s.image_source.length === 0);

  console.log('Total stories:', data.length);
  console.log('With image_source:', withSource.length);
  console.log('Without image_source:', withoutSource.length);
  
  console.log('\nStories WITH source (first 5):');
  withSource.slice(0, 5).forEach(s => console.log('  -', s.title));
  
  console.log('\nImage paths of stories WITHOUT source (sample):');
  withoutSource.slice(0, 5).forEach(s => console.log('  -', s.title, '|', s.image_path?.substring(0, 40)));
}

check();
