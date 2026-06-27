-- AI Gateway usage tracking table
-- Run this migration to enable usage logging

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,          -- 'anthropic' | 'openai' | 'perplexity'
  model TEXT NOT NULL,             -- 'claude-sonnet-4-6', 'gpt-4o', etc.
  tier TEXT NOT NULL,              -- 'drafting' | 'supervision' | 'research'
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage_logs(model);

-- Aggregate view for dashboard
CREATE OR REPLACE VIEW ai_usage_summary AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  provider,
  model,
  tier,
  COUNT(*) AS total_calls,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_usd) AS total_cost_usd,
  AVG(latency_ms) AS avg_latency_ms,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) AS cached_calls
FROM ai_usage_logs
GROUP BY DATE_TRUNC('day', created_at), provider, model, tier;

-- Row Level Security
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users see own usage" ON ai_usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (backend inserts logs)
CREATE POLICY "Service role inserts usage" ON ai_usage_logs
  FOR INSERT
  WITH CHECK (true);

-- Admin can see all usage
CREATE POLICY "Admin sees all usage" ON ai_usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()
    )
  );
