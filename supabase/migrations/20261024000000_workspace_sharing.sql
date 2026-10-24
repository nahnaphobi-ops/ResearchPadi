-- Workspace sharing, comments and version history. New tables only; nothing
-- existing changes. Only the backend (service role) touches them. Safe to re-run.

-- Snapshots of a document: saved automatically every so often while the
-- student writes, by hand ("Save a version"), and before a restore.
CREATE TABLE IF NOT EXISTS workspace_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workspace_sessions(id) ON DELETE CASCADE,
  -- Who saved it: the owner, or someone editing through a share link.
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  word_count INT NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workspace_versions_session_idx ON workspace_versions (session_id, created_at DESC);

-- Links the owner hands out: view only, view and comment, or edit (signed-in co-writers).
CREATE TABLE IF NOT EXISTS workspace_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workspace_sessions(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('view', 'comment', 'edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS workspace_shares_session_idx ON workspace_shares (session_id);

-- Comments on a passage (the exact text, and which occurrence if it repeats), with replies.
CREATE TABLE IF NOT EXISTS workspace_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workspace_sessions(id) ON DELETE CASCADE,
  share_id UUID REFERENCES workspace_shares(id) ON DELETE SET NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  parent_id UUID REFERENCES workspace_comments(id) ON DELETE CASCADE,
  anchor_text TEXT NOT NULL DEFAULT '',
  occurrence INT NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workspace_comments_session_idx ON workspace_comments (session_id, created_at);

ALTER TABLE workspace_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_comments ENABLE ROW LEVEL SECURITY;
