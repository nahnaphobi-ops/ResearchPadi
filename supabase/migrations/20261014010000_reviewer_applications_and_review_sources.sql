-- 1. Reviewers apply and are vetted by an admin; vetting details are kept.
-- 2. Human review works on any generation (workspace document, full paper,
--    care study), routed by specialty.
-- Safe to re-run.

-- ── Reviewer vetting ─────────────────────────────────────────────────────
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS specialties TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS years_experience INT;
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS vetted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS vetted_at TIMESTAMPTZ;
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS vetting_notes TEXT;
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS application_id UUID;

CREATE TABLE IF NOT EXISTS reviewer_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Shown to students if approved.
  display_name TEXT NOT NULL,
  institution TEXT NOT NULL,
  qualification TEXT NOT NULL,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  years_experience INT NOT NULL,
  bio TEXT,
  -- Optional link (LinkedIn, institutional page, shared CV) for the admin to check.
  profile_url TEXT,
  declaration_confirmed_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reviewer_applications_status_idx ON reviewer_applications (status, created_at);
-- One open application per person.
CREATE UNIQUE INDEX IF NOT EXISTS reviewer_applications_one_pending ON reviewer_applications (user_id) WHERE status = 'pending';
ALTER TABLE reviewer_applications ENABLE ROW LEVEL SECURITY;

-- ── Reviews of any generation ────────────────────────────────────────────
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'workspace';
ALTER TABLE review_requests DROP CONSTRAINT IF EXISTS review_requests_source_type_check;
ALTER TABLE review_requests ADD CONSTRAINT review_requests_source_type_check CHECK (source_type IN ('workspace', 'paper', 'care_study'));
-- The paper or care study being reviewed (workspace reviews keep using session_id).
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS source_id UUID;
-- Only reviewers with this specialty may take the request (NULL = any reviewer).
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS specialty TEXT;
CREATE INDEX IF NOT EXISTS review_requests_source_idx ON review_requests (source_type, source_id);
