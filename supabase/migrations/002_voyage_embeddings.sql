-- Migration: Update vector dimensions from 1536 to 1024 for Voyage AI voyage-3 model
-- NOTE: This will delete all existing embeddings - they need to be regenerated

-- Clear existing data (embeddings will be regenerated with new dimensions)
truncate table chunks;
truncate table images;

-- Drop the old index
drop index if exists chunks_embedding_idx;

-- Drop and recreate the embedding column with 1024 dimensions
alter table chunks drop column embedding;
alter table chunks add column embedding vector(1024);

-- Recreate the index with new dimensions
create index chunks_embedding_idx on chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Update the match_chunks function for 1024 dimensions
create or replace function match_chunks(
  query_embedding vector(1024),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  source_pdf text,
  page_number int,
  section_title text,
  image_refs text[],
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.content,
    chunks.source_pdf,
    chunks.page_number,
    chunks.section_title,
    chunks.image_refs,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;
