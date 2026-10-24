-- Real-time co-writing: the shared editing state (a Yjs document) of each
-- Workspace document that has an "edit" share link. The HTML in
-- workspace_sessions.content stays the copy everything else reads; this is
-- only what the live editors sync through. New table only. Safe to re-run.
CREATE TABLE IF NOT EXISTS workspace_collab (
  session_id UUID PRIMARY KEY REFERENCES workspace_sessions(id) ON DELETE CASCADE,
  -- Yjs update encoding of the whole document, base64.
  state TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the backend (service role) touches it.
ALTER TABLE workspace_collab ENABLE ROW LEVEL SECURITY;
