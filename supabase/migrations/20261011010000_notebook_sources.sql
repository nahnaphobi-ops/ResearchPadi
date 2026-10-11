-- Notebook sources (Premium): a student's own documents attached to a workspace
-- session — PDFs, Word files, web pages, pasted notes — chunked for grounded chat.
-- Only the backend (service role) reads or writes these. Safe to re-run.

CREATE TABLE IF NOT EXISTS notebook_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workspace_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pdf', 'docx', 'txt', 'url', 'text')),
  url TEXT,
  -- Optional details so the source can be cited properly ("Family, Given; …").
  authors TEXT,
  year INT,
  char_count INT NOT NULL DEFAULT 0,
  chunk_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notebook_sources_session_idx ON notebook_sources (session_id, created_at);

CREATE TABLE IF NOT EXISTS notebook_chunks (
  id BIGSERIAL PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES notebook_sources(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES workspace_sessions(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  content_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);
CREATE INDEX IF NOT EXISTS notebook_chunks_session_idx ON notebook_chunks (session_id);
CREATE INDEX IF NOT EXISTS notebook_chunks_source_idx ON notebook_chunks (source_id, chunk_index);
CREATE INDEX IF NOT EXISTS notebook_chunks_tsv_idx ON notebook_chunks USING GIN (content_tsv);

ALTER TABLE notebook_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_chunks ENABLE ROW LEVEL SECURITY;

-- Hybrid search inside one session: keyword (full text) and, when an embedding is
-- given, vector similarity, merged by reciprocal-rank fusion. Each session holds at
-- most a few thousand chunks, so an exact scan is fast without a vector index.
CREATE OR REPLACE FUNCTION search_notebook(
  p_session UUID,
  p_query TEXT,
  p_embedding vector(1536) DEFAULT NULL,
  p_limit INT DEFAULT 8
) RETURNS TABLE (id BIGINT, source_id UUID, chunk_index INT, content TEXT, score DOUBLE PRECISION)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', coalesce(p_query, '')) AS tsq
  ),
  keyword AS (
    SELECT c.id, row_number() OVER (ORDER BY ts_rank_cd(c.content_tsv, q.tsq) DESC) AS rnk
    FROM notebook_chunks c, q
    WHERE c.session_id = p_session AND c.content_tsv @@ q.tsq
    ORDER BY ts_rank_cd(c.content_tsv, q.tsq) DESC
    LIMIT 40
  ),
  semantic AS (
    SELECT c.id, row_number() OVER (ORDER BY c.embedding <=> p_embedding) AS rnk
    FROM notebook_chunks c
    WHERE p_embedding IS NOT NULL AND c.session_id = p_session AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> p_embedding
    LIMIT 40
  ),
  fused AS (
    SELECT id, sum(1.0 / (60 + rnk)) AS score
    FROM (SELECT * FROM keyword UNION ALL SELECT * FROM semantic) r
    GROUP BY id
  )
  SELECT c.id, c.source_id, c.chunk_index, c.content, f.score
  FROM fused f JOIN notebook_chunks c ON c.id = f.id
  ORDER BY f.score DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION search_notebook(UUID, TEXT, vector, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION search_notebook(UUID, TEXT, vector, INT) TO service_role;
