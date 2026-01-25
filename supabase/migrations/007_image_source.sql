-- Migration: Add image_source field for attribution
-- This allows tracking the source/credit for story images

-- Add image_source column to stories table
ALTER TABLE stories ADD COLUMN IF NOT EXISTS image_source text;

-- Add comment for documentation
COMMENT ON COLUMN stories.image_source IS 'Attribution/source for the story image (photographer, website, etc.)';
