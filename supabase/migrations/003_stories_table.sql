-- Migration: Add stories table for dynamic story loading
-- This replaces the hardcoded stories in stories-data.ts

-- Stories table for immersive visual stories
create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,  -- URL-friendly identifier (e.g., "lagos-covadonga")
  title text not null,
  subtitle text,
  description text,
  image_path text,  -- Path to image or external URL
  category text not null,  -- nature, cities, food, culture, activities
  source_pdf text,  -- Reference to source PDF for content
  location text,  -- Geographic area: eastern, central, western
  duration text,  -- Trip type: day-trip, weekend, week
  display_order int default 0,  -- For manual ordering
  is_active boolean default true,  -- For soft delete/draft functionality
  related_stories uuid[],  -- AI-suggested related story IDs
  metadata jsonb default '{}',  -- Flexible field for future data
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes for common queries
create index if not exists stories_category_idx on stories (category);
create index if not exists stories_location_idx on stories (location);
create index if not exists stories_active_idx on stories (is_active) where is_active = true;
create index if not exists stories_order_idx on stories (display_order);
create index if not exists stories_slug_idx on stories (slug);

-- Enable Row Level Security
alter table stories enable row level security;

-- Allow public read access for active stories
create policy "Public read access for active stories"
  on stories for select
  using (is_active = true);

-- Function to update the updated_at timestamp
create or replace function update_stories_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger stories_updated_at
  before update on stories
  for each row
  execute function update_stories_updated_at();
