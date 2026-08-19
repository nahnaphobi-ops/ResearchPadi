-- Create tables that backend code already writes to (auditLog / AI gateway).
-- Previously these inserts failed silently because no migration created the tables.
-- user_id / actor references public.users (app table), not auth.users.

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads audit logs" ON audit_logs;
CREATE POLICY "Admin reads audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role inserts audit logs" ON audit_logs;
CREATE POLICY "Service role inserts audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tier TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage_logs(model);

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

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own usage" ON ai_usage_logs;
CREATE POLICY "Users see own usage" ON ai_usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role inserts usage" ON ai_usage_logs;
CREATE POLICY "Service role inserts usage" ON ai_usage_logs
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin sees all usage" ON ai_usage_logs;
CREATE POLICY "Admin sees all usage" ON ai_usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()
    )
  );

GRANT ALL ON TABLE audit_logs TO service_role;
GRANT ALL ON TABLE ai_usage_logs TO service_role;
GRANT SELECT ON TABLE ai_usage_summary TO service_role;
