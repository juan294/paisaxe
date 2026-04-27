-- ============================================================================
-- Migration: 084_switch_to_hnsw_index.sql
-- Purpose: Replace IVFFlat index with HNSW for better vector recall
--
-- Problem: The IVFFlat index (lists=100) used by match_chunks never set
-- ivfflat.probes, so the default probes=1 was used — giving poor recall.
-- HNSW provides better recall without requiring probe tuning.
--
-- Changes:
--   1. Drop the existing IVFFlat index on chunks.embedding
--   2. Create an HNSW index (m=16, ef_construction=64)
--   3. Update match_chunks to set hnsw.ef_search=40 at query time
--
-- Index parameters:
--   m=16           — number of bi-directional links per node (default 16)
--   ef_construction=64 — build-time search width (higher = better quality,
--                        slower build; 64 is a good default for this dataset)
--   ef_search=40   — query-time search width (higher = better recall,
--                    slower queries; 40 balances recall vs. latency)
--
-- NOTE: This migration file is for review only.
-- It has NOT been applied to the production database.
-- Apply manually after review: supabase db push (or via Supabase dashboard)
-- ============================================================================

SET search_path = public, extensions;

-- Step 1: Drop the existing IVFFlat index
DROP INDEX IF EXISTS chunks_embedding_idx;

-- Step 2: Create HNSW index with cosine distance operator
-- HNSW provides better recall than IVFFlat without requiring probe tuning.
CREATE INDEX chunks_embedding_idx ON public.chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Step 3: Update match_chunks to set hnsw.ef_search before executing the query.
-- Switched from LANGUAGE sql to LANGUAGE plpgsql so we can issue SET LOCAL
-- inside the function body. SET LOCAL scopes the parameter to the current
-- transaction, so it does not leak across connections.
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
LANGUAGE plpgsql STABLE
SET search_path = public, extensions
AS $$
BEGIN
  -- Set ef_search for this transaction to balance recall vs. latency.
  -- A value of 40 (2× the default 20) improves recall with minimal overhead.
  SET LOCAL hnsw.ef_search = 40;

  RETURN QUERY
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
END;
$$;
