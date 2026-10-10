-- Hybrid (keyword + vector) retrieval over the Ghanaian knowledge base.
-- Keyword search works with no embedding provider; vectors are used when present.
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Citation metadata that harvesters and OpenAlex ingestion can fill in.
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS doi TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS journal TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS publisher TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS language TEXT;

-- Weighted full-text vector: title (A) > abstract/text (B) > authors/field (C).
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(document_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(chunk_text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(authors, '') || ' ' || coalesce(field, '') || ' ' || coalesce(institution, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search_tsv ON knowledge_chunks USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_title_trgm ON knowledge_chunks USING gin (document_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source_url ON knowledge_chunks (source_url);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doi ON knowledge_chunks (lower(doi)) WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_year ON knowledge_chunks (year);

-- Reciprocal-rank fusion of keyword rank and vector similarity, best chunk per document.
CREATE OR REPLACE FUNCTION search_knowledge(
  p_query TEXT,
  p_embedding VECTOR(1536) DEFAULT NULL,
  p_limit INT DEFAULT 8,
  p_field TEXT DEFAULT NULL,
  p_institution TEXT DEFAULT NULL,
  p_year_from INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_title TEXT,
  chunk_text TEXT,
  authors TEXT,
  year INTEGER,
  institution TEXT,
  source_name TEXT,
  source_url TEXT,
  field TEXT,
  doi TEXT,
  journal TEXT,
  publisher TEXT,
  document_type TEXT,
  keyword_rank REAL,
  vector_similarity DOUBLE PRECISION,
  score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  WITH
  -- OR the query's stemmed terms so natural-language questions still match;
  -- cover-density ranking rewards chunks that contain more of them, closer together.
  q AS (
    SELECT CASE
      WHEN coalesce(trim(p_query), '') = '' THEN NULL
      ELSE to_tsquery('english', coalesce(nullif(array_to_string(
             ARRAY(SELECT quote_literal(lexeme) FROM unnest(tsvector_to_array(to_tsvector('english', p_query))) AS lexeme),
             ' | '), ''), 'zzzznomatch'))
    END AS tsq
  ),
  filtered AS (
    SELECT kc.*
    FROM knowledge_chunks kc
    WHERE (p_field IS NULL OR kc.field ILIKE '%' || p_field || '%')
      AND (p_institution IS NULL OR kc.institution ILIKE '%' || p_institution || '%' OR kc.source_name ILIKE '%' || p_institution || '%')
      AND (p_year_from IS NULL OR kc.year >= p_year_from)
  ),
  kw AS (
    SELECT f.id,
           ts_rank_cd(f.search_tsv, q.tsq, 32) + 0.3 * similarity(f.document_title, p_query) AS rank,
           row_number() OVER (ORDER BY ts_rank_cd(f.search_tsv, q.tsq, 32) + 0.3 * similarity(f.document_title, p_query) DESC) AS rn
    FROM filtered f, q
    WHERE q.tsq IS NOT NULL AND f.search_tsv @@ q.tsq
    ORDER BY rank DESC
    LIMIT 60
  ),
  vec AS (
    SELECT f.id,
           1 - (f.embedding <=> p_embedding) AS sim,
           row_number() OVER (ORDER BY f.embedding <=> p_embedding) AS rn
    FROM filtered f
    WHERE p_embedding IS NOT NULL AND f.embedding IS NOT NULL
    ORDER BY f.embedding <=> p_embedding
    LIMIT 60
  ),
  fused AS (
    SELECT coalesce(kw.id, vec.id) AS id,
           kw.rank AS keyword_rank,
           vec.sim AS vector_similarity,
           coalesce(1.0 / (60 + kw.rn), 0) + coalesce(1.0 / (60 + vec.rn), 0) AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  ),
  best_per_document AS (
    SELECT DISTINCT ON (lower(kc.document_title))
           kc.id, kc.document_title, kc.chunk_text, kc.authors, kc.year, kc.institution, kc.source_name,
           kc.source_url, kc.field, kc.doi, kc.journal, kc.publisher, kc.document_type,
           fu.keyword_rank::REAL, fu.vector_similarity, fu.score
    FROM fused fu
    JOIN knowledge_chunks kc ON kc.id = fu.id
    ORDER BY lower(kc.document_title), fu.score DESC
  )
  SELECT * FROM best_per_document
  ORDER BY score DESC
  LIMIT greatest(1, least(p_limit, 50));
$$;

REVOKE ALL ON FUNCTION search_knowledge(TEXT, VECTOR, INT, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION search_knowledge(TEXT, VECTOR, INT, TEXT, TEXT, INT) TO service_role;
