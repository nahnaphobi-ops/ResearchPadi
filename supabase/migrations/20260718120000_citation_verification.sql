-- Citation Verification Module (ResearchPadi)
-- Adds audit trail for deterministic citation verification and a report
-- column on papers so a human reviewer can inspect each run.

-- 1. Audit table: one row per verified citation per paper run.
CREATE TABLE IF NOT EXISTS citation_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  citation_id TEXT NOT NULL,
  raw_string TEXT,
  parsed_authors JSONB DEFAULT '[]',
  parsed_year INTEGER,
  parsed_title TEXT,
  match_status TEXT NOT NULL
    CHECK (match_status IN ('verified', 'partial_match', 'unverified')),
  matched_source TEXT NOT NULL
    CHECK (matched_source IN ('rag', 'openalex', 'semantic_scholar', 'none', 'api_unavailable')),
  matched_record_id TEXT,
  confidence_score NUMERIC,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citation_verifications_paper
  ON citation_verifications (paper_id);

-- 2. Attach the run summary + a quick status flag to the paper record.
--    citation_status drives the delivery policy hook (deliver vs manual_review).
ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS citation_report JSONB,
  ADD COLUMN IF NOT EXISTS citation_status TEXT
    CHECK (citation_status IN ('verified', 'needs_review'));

CREATE INDEX IF NOT EXISTS idx_papers_citation_status
  ON papers (citation_status);
