-- Guided care studies for nursing and midwifery training college students.
-- The student enters the facts about a real client section by section; the AI
-- only rewords, orders and explains them. Templates live as JSON files in
-- backend/src/blueprints/care-studies, not in the database.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS care_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  -- Initials or a pseudonym only; the API rejects full names.
  pseudonym TEXT NOT NULL,
  -- Diagnosis or obstetric summary, used to search for sources.
  focus TEXT NOT NULL DEFAULT '',
  institution_name TEXT,
  supervisor_name TEXT,
  consent_confirmed_at TIMESTAMPTZ NOT NULL,
  declaration_confirmed_at TIMESTAMPTZ NOT NULL,
  -- Sources retrieved by the search pipeline; the only ones a draft may cite.
  sources JSONB NOT NULL DEFAULT '[]',
  sources_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS care_studies_user_idx ON care_studies (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS care_study_sections (
  care_study_id UUID NOT NULL REFERENCES care_studies(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  -- The student's own entries: { fields: {...}, items: [{...}] }.
  entries JSONB NOT NULL DEFAULT '{}',
  draft TEXT,
  drafted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (care_study_id, section_key)
);

-- Append-only history: the student's notes, every AI draft and every edit.
CREATE TABLE IF NOT EXISTS care_study_versions (
  id BIGSERIAL PRIMARY KEY,
  care_study_id UUID NOT NULL REFERENCES care_studies(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('notes', 'draft', 'edit')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS care_study_versions_idx ON care_study_versions (care_study_id, section_key, created_at DESC);

ALTER TABLE care_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_study_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_study_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own care studies only" ON care_studies;
CREATE POLICY "Own care studies only" ON care_studies
  FOR ALL USING (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "Own care study sections only" ON care_study_sections;
CREATE POLICY "Own care study sections only" ON care_study_sections
  FOR ALL USING (EXISTS (
    SELECT 1 FROM care_studies c WHERE c.id = care_study_id AND c.user_id::text = auth.uid()::text
  ));

DROP POLICY IF EXISTS "Own care study versions only" ON care_study_versions;
CREATE POLICY "Own care study versions only" ON care_study_versions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM care_studies c WHERE c.id = care_study_id AND c.user_id::text = auth.uid()::text
  ));
