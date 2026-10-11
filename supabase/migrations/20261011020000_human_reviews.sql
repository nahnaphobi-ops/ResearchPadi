-- Human supervisor review (Premium): a student pays from their wallet to have a
-- vetted reviewer comment on a document before it goes to their real supervisor.
-- Only the backend (service role) touches these tables. Safe to re-run.

-- Reviewers are ordinary user accounts that an admin has approved.
CREATE TABLE IF NOT EXISTS reviewers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES workspace_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('excerpt', 'full')),
  notes TEXT,
  -- What the reviewer sees: the document (or selected part) as it was when submitted.
  content_snapshot TEXT NOT NULL,
  word_count INT NOT NULL,
  price_ghs NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'returned', 'cancelled')),
  reviewer_id UUID REFERENCES reviewers(user_id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  summary TEXT,
  -- Rubric scores 1–5, e.g. {"structure":4,"methodology":3,...}
  scores JSONB,
  -- Context shown to the reviewer instead of the student's identity.
  institution_type TEXT,
  programme TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS review_requests_user_idx ON review_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_requests_status_idx ON review_requests (status, created_at);
CREATE INDEX IF NOT EXISTS review_requests_reviewer_idx ON review_requests (reviewer_id, status);
CREATE INDEX IF NOT EXISTS review_requests_session_idx ON review_requests (session_id);

CREATE TABLE IF NOT EXISTS review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES reviewers(user_id) ON DELETE SET NULL,
  -- The exact text the comment is about, and which occurrence (0-based) if it repeats.
  anchor_text TEXT NOT NULL,
  occurrence INT NOT NULL DEFAULT 0,
  comment TEXT NOT NULL,
  suggestion TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS review_comments_request_idx ON review_comments (request_id, created_at);

ALTER TABLE reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;

-- Claim the oldest-or-chosen pending request atomically so two reviewers can't take
-- the same one. Returns the claimed row, or nothing if it was already taken.
CREATE OR REPLACE FUNCTION claim_review(p_request UUID, p_reviewer UUID, p_hours INT DEFAULT 48)
RETURNS SETOF review_requests
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE review_requests
     SET status = 'in_review',
         reviewer_id = p_reviewer,
         claimed_at = NOW(),
         due_at = NOW() + make_interval(hours => p_hours)
   WHERE id = p_request AND status = 'pending' AND reviewer_id IS NULL
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION claim_review(UUID, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_review(UUID, UUID, INT) TO service_role;
