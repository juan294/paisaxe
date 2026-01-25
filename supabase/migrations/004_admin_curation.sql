-- Migration: Add curation status tracking for admin panel
-- Allows tracking which stories have been manually curated

-- Add curation status to stories
ALTER TABLE stories ADD COLUMN IF NOT EXISTS curation_status text DEFAULT 'needs_curation';

-- Create index for filtering by curation status
CREATE INDEX IF NOT EXISTS stories_curation_status_idx ON stories (curation_status);

-- Create storage bucket for uploaded images (if not exists)
-- Note: This must be run with admin privileges
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-images', 'story-images', true)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policy to allow public read access to uploaded images
CREATE POLICY IF NOT EXISTS "Public read access for story images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-images');

-- Add RLS policy to allow service role to upload images
CREATE POLICY IF NOT EXISTS "Service role can upload story images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'story-images');

-- Add RLS policy to allow service role to update images
CREATE POLICY IF NOT EXISTS "Service role can update story images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'story-images');

-- Add RLS policy to allow service role to delete images
CREATE POLICY IF NOT EXISTS "Service role can delete story images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'story-images');
