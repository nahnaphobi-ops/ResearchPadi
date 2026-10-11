-- One extra supervisor review per paper is included in the price; this records
-- when it was used (papers.controller superviseCompletedPaper claims it).
-- Safe to re-run.
ALTER TABLE papers ADD COLUMN IF NOT EXISTS resupervised_at TIMESTAMPTZ;
