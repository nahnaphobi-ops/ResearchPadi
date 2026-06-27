-- pgvector setup for native vector search
-- Run this migration to enable vector similarity search

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add vector column if not exists (1536 dimensions for text-embedding-3-small)
-- The 'embedding' column already exists in knowledge_chunks from the harvester.
-- This migration ensures it's the correct type.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
    AND udt_name = 'vector'
  ) THEN
    -- If column exists as jsonb/text, convert it
    ALTER TABLE knowledge_chunks
      DROP COLUMN IF EXISTS embedding;
    ALTER TABLE knowledge_chunks
      ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- 3. Create HNSW index for fast approximate nearest neighbor search
-- HNSW is faster than IVFFlat for datasets < 1M rows
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Create the match function (used by Supabase RPC)
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_title text,
  chunk_text text,
  institution text,
  source_name text,
  authors text,
  year integer,
  field text,
  source_url text,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_title,
    kc.chunk_text,
    kc.institution,
    kc.source_name,
    kc.authors,
    kc.year,
    kc.field,
    kc.source_url,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Add index for text search fallback
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_text_search
  ON knowledge_chunks
  USING gin (to_tsvector('english', coalesce(document_title, '') || ' ' || coalesce(chunk_text, '')));

-- 6. Add index for source_name filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source_name
  ON knowledge_chunks (source_name);

-- 7. Add index for institution filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_institution
  ON knowledge_chunks (institution);
