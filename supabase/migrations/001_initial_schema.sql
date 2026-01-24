-- Enable pgvector extension
create extension if not exists vector;

-- Chunks table for PDF content
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536),
  source_pdf text not null,
  page_number int,
  section_title text,
  image_refs text[],
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Images table for extracted PDF images
create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  caption text,
  source_pdf text not null,
  page_number int,
  tags text[],
  created_at timestamptz default now()
);

-- Create index for vector similarity search
create index if not exists chunks_embedding_idx on chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create index for keyword search
create index if not exists chunks_content_idx on chunks
using gin (to_tsvector('spanish', content));

-- Create index for source PDF filtering
create index if not exists chunks_source_pdf_idx on chunks (source_pdf);
create index if not exists images_source_pdf_idx on images (source_pdf);

-- Function to match chunks by embedding similarity
create or replace function match_chunks(
  query_embedding vector(1536),
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

-- Row Level Security (optional, for future use)
alter table chunks enable row level security;
alter table images enable row level security;

-- Allow public read access
create policy "Public read access for chunks"
  on chunks for select
  using (true);

create policy "Public read access for images"
  on images for select
  using (true);
