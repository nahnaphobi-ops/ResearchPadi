-- Performance indexes for high-concurrency workloads (tuned for 500+ concurrent users).
-- Additive only (IF NOT EXISTS); safe to apply at any scale, including before a Pro-tier move.
-- Note: audit_logs and ai_usage_logs are referenced in code but are NOT created by any
-- migration — do not add indexes for them until those tables are created.

-- subscriptions: checked on EVERY authenticated request (requireSubscription middleware).
-- Query filters user_id + status='active' + expires_at > now(), ordered by expires_at desc.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_expires
  ON subscriptions (user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON subscriptions (user_id);

-- papers: user listing ordered by created_at desc, and status-filtered admin counts.
CREATE INDEX IF NOT EXISTS idx_papers_user_created
  ON papers (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_status
  ON papers (status);

-- transactions: per-user history (ordered) + admin revenue sums (status/type/created_at).
CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status_type_created
  ON transactions (status, type, created_at);

-- wallets: looked up by user on every wallet read / payment webhook.
CREATE INDEX IF NOT EXISTS idx_wallets_user_id
  ON wallets (user_id);

-- workspace_sessions: session-limit check runs per request for standard-plan users.
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_user_id
  ON workspace_sessions (user_id);

-- assignment_sessions: per-user listing.
CREATE INDEX IF NOT EXISTS idx_assignment_sessions_user_id
  ON assignment_sessions (user_id);

-- knowledge_chunks: admin grouping/filters by field and source_name.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_field
  ON knowledge_chunks (field);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source_name
  ON knowledge_chunks (source_name);
