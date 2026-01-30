-- Migration: Add blur placeholder data URL for progressive image loading
-- This improves LCP by showing a blurred preview while the full image loads

-- Add blur_data_url column to stories table
ALTER TABLE stories ADD COLUMN IF NOT EXISTS blur_data_url TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN stories.blur_data_url IS 'Base64 data URL for blur placeholder (32x32 WebP). Generated at upload time for progressive loading.';

-- Index is not needed as this is only read along with other story data, never queried independently
