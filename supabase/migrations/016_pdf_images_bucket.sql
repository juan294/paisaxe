-- Migration: Create storage bucket for PDF-extracted images
-- These are the ~739 images extracted from tourism PDFs, uploaded to Supabase Storage
-- for use in chat responses via the images table and chunk image_refs

-- Create storage bucket for PDF images (publicly readable)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-images', 'pdf-images', true)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for storage (drop first if exists to make idempotent)
DO $$
BEGIN
  -- Public read access
  DROP POLICY IF EXISTS "Public read access for pdf images" ON storage.objects;
  CREATE POLICY "Public read access for pdf images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'pdf-images');

  -- Service role upload
  DROP POLICY IF EXISTS "Service role can upload pdf images" ON storage.objects;
  CREATE POLICY "Service role can upload pdf images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'pdf-images');

  -- Service role update
  DROP POLICY IF EXISTS "Service role can update pdf images" ON storage.objects;
  CREATE POLICY "Service role can update pdf images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'pdf-images');

  -- Service role delete
  DROP POLICY IF EXISTS "Service role can delete pdf images" ON storage.objects;
  CREATE POLICY "Service role can delete pdf images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'pdf-images');
END $$;
