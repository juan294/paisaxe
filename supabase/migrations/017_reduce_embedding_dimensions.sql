-- ============================================================================
-- Migration: 016_reduce_embedding_dimensions.sql
-- Purpose: Reduce embedding dimensions from 1024 to 512
--
-- Uses Matryoshka embeddings: the first 512 dimensions of a 1024-dim
-- voyage-3 vector are valid embeddings with minimal retrieval quality loss.
-- This saves ~50% pgvector storage (important for Supabase free tier).
--
-- NOTE: Existing data must be re-seeded after this migration.
--       Run: npm run seed-db:clear
-- ============================================================================

-- Ensure pgvector types are visible (extension lives in 'extensions' schema)
SET search_path = public, extensions;

-- Step 1: Drop the existing index (must be recreated with new dimensions)
DROP INDEX IF EXISTS chunks_embedding_idx;

-- Step 2: Alter the embedding column to 512 dimensions
ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(512);

-- Step 3: Recreate the IVFFlat index with 512 dimensions
CREATE INDEX chunks_embedding_idx ON chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 4: Update the match_chunks function for 512 dimensions
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  source_pdf text,
  page_number int,
  section_title text,
  image_refs text[],
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    chunks.id,
    chunks.content,
    chunks.source_pdf,
    chunks.page_number,
    chunks.section_title,
    chunks.image_refs,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM public.chunks
  WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;
