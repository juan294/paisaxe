-- ============================================================================
-- Migration: 111_match_chunks_hnsw_index.sql
-- Purpose: Give vector search a working HNSW index and a working match_chunks.
--
-- Why: production's chunks_embedding_idx was still the original IVFFlat index
-- (lists = 100) and match_chunks was still the plain-SQL function from 017.
-- IVFFlat probes ~1 list of 100 by default (~1% of the corpus per query), so
-- recall was poor: with correct query vectors, 4 of 12 on-topic questions still
-- returned no chunks through the real search path.
--
-- Migration 086 was meant to fix that, but it never took effect: it is recorded
-- as applied while its own header says "has NOT been applied", and it cannot be
-- applied as written -- it issues `SET LOCAL hnsw.ef_search` inside a function
-- declared STABLE, and PostgreSQL rejects that at call time
-- ("SET is not allowed in a non-volatile function"), which would make every
-- search call fail. Do not replay 086's function body anywhere.
--
-- Fix:
--   1. Replace the IVFFlat index with HNSW (m = 16, ef_construction = 64).
--   2. Replace match_chunks with a LANGUAGE sql STABLE function that carries the
--      query-time search width as a function attribute (SET hnsw.ef_search),
--      which PostgreSQL allows on non-volatile functions and restores after the
--      call. ef_search = 100 (>= the 10 candidates the app asks for before rerank)
--      gives near-exact recall at this corpus size (~3k chunks).
--   3. Fail closed: abort if the index is not HNSW or the function lost its setting.
--
-- Idempotent. Function signature and the anon/authenticated EXECUTE grants the
-- app relies on (it calls match_chunks with the anon key) are unchanged.
-- ============================================================================

DROP INDEX IF EXISTS public.chunks_embedding_idx;

CREATE INDEX chunks_embedding_idx ON public.chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 5
) RETURNS TABLE (
  id uuid,
  content text,
  source_pdf text,
  page_number integer,
  section_title text,
  image_refs text[],
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
SET hnsw.ef_search TO '100'
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

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, double precision, integer)
  TO anon, authenticated, service_role;

DO $$
DECLARE
  index_method text;
  fn_config text;
BEGIN
  SELECT am.amname INTO index_method
  FROM pg_class c
  JOIN pg_am am ON am.oid = c.relam
  WHERE c.oid = 'public.chunks_embedding_idx'::regclass;

  IF index_method IS DISTINCT FROM 'hnsw' THEN
    RAISE EXCEPTION 'chunks_embedding_idx must be an HNSW index, found: %', index_method;
  END IF;

  SELECT proconfig::text INTO fn_config
  FROM pg_proc
  WHERE oid = 'public.match_chunks(vector, double precision, integer)'::regprocedure;

  IF fn_config IS NULL OR fn_config NOT LIKE '%hnsw.ef_search=100%' THEN
    RAISE EXCEPTION 'match_chunks lost its hnsw.ef_search setting: %', fn_config;
  END IF;
END
$$;
