-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  institution_type TEXT NOT NULL
    CHECK (institution_type IN (
      'university', 'nmtc',
      'technical_university', 'college_of_education'
    )),
  institution_name TEXT NOT NULL,
  programme TEXT,
  level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  balance_ghs DECIMAL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions (Workspace plans)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('standard', 'premium')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_ghs DECIMAL NOT NULL,
  product TEXT,
  reference TEXT,
  hubtel_reference TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Papers
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  topic TEXT NOT NULL,
  course TEXT,
  institution_type TEXT,
  institution_name TEXT,
  programme TEXT,
  supervisor_name TEXT,
  target_word_count INTEGER DEFAULT 12000,
  actual_word_count INTEGER,
  status TEXT DEFAULT 'processing'
    CHECK (status IN (
      'processing', 'researching', 'drafting',
      'supervising', 'completed', 'failed'
    )),
  progress_step TEXT,
  chapters JSONB DEFAULT '{}',
  final_content TEXT,
  abstract TEXT,
  sources_used JSONB DEFAULT '[]',
  file_url_docx TEXT,
  file_url_pdf TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Workspace Sessions
CREATE TABLE workspace_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT DEFAULT '',
  course TEXT,
  institution_type TEXT,
  uploaded_materials JSONB DEFAULT '[]',
  sources_used JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignment Sessions
CREATE TABLE assignment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notebook_name TEXT NOT NULL,
  course TEXT NOT NULL,
  institution_type TEXT,
  uploaded_materials JSONB DEFAULT '[]',
  sessions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RAG Knowledge Base
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_url TEXT,
  document_title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  institution TEXT,
  field TEXT,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector index
CREATE INDEX ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Harvest Logs
CREATE TABLE harvest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  records_fetched INTEGER DEFAULT 0,
  records_added INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  harvested_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC function for vector similarity search
CREATE OR REPLACE FUNCTION match_knowledge_chunks (
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  document_title TEXT,
  chunk_text TEXT,
  institution TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_title,
    kc.chunk_text,
    kc.institution,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Own data only" ON users
  FOR ALL USING (auth.uid()::text = id::text);

CREATE POLICY "Own wallet only" ON wallets
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Own papers only" ON papers
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Own workspace only" ON workspace_sessions
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Own assignments only" ON assignment_sessions
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Own transactions only" ON transactions
  FOR ALL USING (user_id::text = auth.uid()::text);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own subscriptions only" ON subscriptions
  FOR ALL USING (user_id::text = auth.uid()::text);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON knowledge_chunks
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE harvest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON harvest_logs
  FOR ALL USING (auth.role() = 'service_role');
