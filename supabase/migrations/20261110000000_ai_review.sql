-- AI review of a finished paper: a reader model takes notes, a supervisor model
-- turns them into suggestions the student can accept or reject. The paper is
-- only changed when the student accepts a suggestion, through
-- apply_review_suggestion below. The backend (service role) writes these
-- tables; students can only read reviews of their own papers. Safe to re-run.

CREATE TABLE IF NOT EXISTS review_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  -- auto: queued when the paper finished; manual: an admin re-ran it;
  -- compare: one side of an admin model comparison (hidden from students).
  kind TEXT NOT NULL DEFAULT 'auto' CHECK (kind IN ('auto', 'manual', 'compare')),
  -- Runs started together by one compare request share this id.
  compare_group UUID,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- degraded: the reader failed, so the supervisor read the paper on its own.
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'degraded', 'failed')),
  reader_model TEXT NOT NULL,
  supervisor_model TEXT NOT NULL,
  passes INT NOT NULL DEFAULT 0,

  -- How the reader's input was fitted under the token limit.
  reader_strategy TEXT CHECK (reader_strategy IN ('full', 'top_sources', 'by_section', 'skipped')),
  -- Prompt size from the token-count endpoint, before the call.
  reader_prompt_tokens INT,

  -- Token usage exactly as the API reported it, summed over the stage's calls.
  reader_input_tokens INT NOT NULL DEFAULT 0,
  reader_output_tokens INT NOT NULL DEFAULT 0,
  reader_cache_read_tokens INT NOT NULL DEFAULT 0,
  reader_cache_write_tokens INT NOT NULL DEFAULT 0,
  reader_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  reader_cost_ghs NUMERIC(12, 4) NOT NULL DEFAULT 0,

  supervisor_input_tokens INT NOT NULL DEFAULT 0,
  supervisor_output_tokens INT NOT NULL DEFAULT 0,
  supervisor_cache_read_tokens INT NOT NULL DEFAULT 0,
  supervisor_cache_write_tokens INT NOT NULL DEFAULT 0,
  supervisor_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  supervisor_cost_ghs NUMERIC(12, 4) NOT NULL DEFAULT 0,

  total_cost_usd NUMERIC(12, 6) GENERATED ALWAYS AS (reader_cost_usd + supervisor_cost_usd) STORED,
  -- The exchange rate the GHS figures were computed with.
  usd_to_ghs NUMERIC(10, 4) NOT NULL,

  suggestions_count INT NOT NULL DEFAULT 0,
  -- Suggestions whose "original" was not in the paper verbatim exactly once
  -- (not found, or found more than once so accepting it could hit the wrong place).
  dropped_suggestions_count INT NOT NULL DEFAULT 0,
  -- Every reason a suggestion was left out: not_found, ambiguous, duplicate, invalid, over_cap.
  drop_details JSONB NOT NULL DEFAULT '{}',
  -- The reader's structured notes, kept for comparing supervisors.
  reader_notes JSONB,
  -- A short message only; never paper text.
  error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS review_runs_paper_idx ON review_runs (paper_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_runs_compare_idx ON review_runs (compare_group) WHERE compare_group IS NOT NULL;
-- At most one queued or running review per paper, kind and supervisor model,
-- so a double click or a retried enqueue can't start the same review twice.
CREATE UNIQUE INDEX IF NOT EXISTS review_runs_one_active_idx
  ON review_runs (paper_id, kind, supervisor_model)
  WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS review_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  -- Hash of original + suggested: a retried job inserts the same keys, which
  -- the unique constraint below ignores, so suggestions are never duplicated.
  suggestion_key TEXT NOT NULL,
  -- The id the supervisor model gave the suggestion.
  model_ref TEXT,
  -- Order shown to the student, highest severity first.
  rank INT NOT NULL,
  section TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('correction', 'citation', 'clarity', 'humanize', 'structure')),
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  -- Exact text from the paper, verbatim.
  original TEXT NOT NULL,
  suggested TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, suggestion_key)
);
CREATE INDEX IF NOT EXISTS review_suggestions_run_idx ON review_suggestions (run_id, rank);

ALTER TABLE review_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_suggestions ENABLE ROW LEVEL SECURITY;

-- Read-only for the paper's owner; admin comparison runs stay hidden.
DROP POLICY IF EXISTS "Own paper reviews only" ON review_runs;
CREATE POLICY "Own paper reviews only" ON review_runs
  FOR SELECT USING (
    kind <> 'compare'
    AND EXISTS (
      SELECT 1 FROM papers p
      WHERE p.id = review_runs.paper_id AND p.user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Own paper review suggestions only" ON review_suggestions;
CREATE POLICY "Own paper review suggestions only" ON review_suggestions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM review_runs r
      JOIN papers p ON p.id = r.paper_id
      WHERE r.id = review_suggestions.run_id
        AND r.kind <> 'compare'
        AND p.user_id::text = auth.uid()::text
    )
  );

-- Accept one suggestion: replace its original text in the paper, but only if
-- that text still appears exactly once (the student may have edited the paper
-- or accepted an overlapping suggestion since). Locks the paper row so two
-- accepts can't overwrite each other.
-- Returns accepted | not_found | not_pending | stale | ambiguous.
CREATE OR REPLACE FUNCTION apply_review_suggestion(p_suggestion UUID, p_user UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  s review_suggestions%ROWTYPE;
  v_paper UUID;
  v_content TEXT;
  v_count INT;
BEGIN
  SELECT * INTO s FROM review_suggestions WHERE id = p_suggestion FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  SELECT p.id, p.final_content INTO v_paper, v_content
    FROM review_runs r JOIN papers p ON p.id = r.paper_id
   WHERE r.id = s.run_id AND p.user_id = p_user
     FOR UPDATE OF p;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  IF s.status <> 'pending' THEN RETURN 'not_pending'; END IF;
  IF v_content IS NULL OR length(s.original) = 0 THEN RETURN 'stale'; END IF;

  v_count := (length(v_content) - length(replace(v_content, s.original, ''))) / length(s.original);
  IF v_count = 0 THEN RETURN 'stale'; END IF;
  IF v_count > 1 THEN RETURN 'ambiguous'; END IF;

  UPDATE papers SET final_content = replace(v_content, s.original, s.suggested) WHERE id = v_paper;
  UPDATE review_suggestions SET status = 'accepted', decided_at = NOW() WHERE id = p_suggestion;
  RETURN 'accepted';
END;
$$;

REVOKE ALL ON FUNCTION apply_review_suggestion(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_review_suggestion(UUID, UUID) TO service_role;
