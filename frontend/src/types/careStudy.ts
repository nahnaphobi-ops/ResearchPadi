/** Guided care study (backend: services/care-study). Templates are data from the API. */
export interface TemplateField {
  key: string;
  label: string;
  hint: string;
  type: 'text' | 'textarea' | 'date' | 'datetime' | 'number';
  required?: boolean;
  min?: number;
  max?: number;
  /** Number fields: must not be more than this other number field of the same entry. */
  not_more_than?: string;
}

/** A chart plotted from the student's own numbers in a section's repeating entries. */
export interface ChartSpec {
  key: string;
  title: string;
  time_field: string;
  note?: string;
  series: { field: string; label: string; min: number; max: number; step: number }[];
}

export interface TemplateSection {
  key: string;
  title: string;
  part?: string;
  stage: string;
  why: string;
  guidance: string;
  fields?: TemplateField[];
  repeat?: { label: string; min: number; fields: TemplateField[] };
  charts?: ChartSpec[];
  requires_sources?: boolean;
}

export interface CareStudyTemplate {
  id: string;
  /** A care study is about a real client; a research project is about a study the student carried out. Default care_study. */
  kind?: 'care_study' | 'research_project';
  name: string;
  description: string;
  notice: string;
  focus_label: string;
  focus_hint: string;
  stages: { key: string; label: string }[];
  sections: TemplateSection[];
}

export interface SectionEntries {
  fields?: Record<string, string>;
  items?: Record<string, string>[];
}

export interface CareStudySectionRow {
  entries?: SectionEntries;
  draft?: string | null;
  drafted_at?: string | null;
  updated_at?: string | null;
}

export interface CareSource {
  id: string;
  title: string;
  authors: string;
  year: number | null;
}

export interface CareStudy {
  id: string;
  template_id: string;
  pseudonym: string;
  focus: string;
  institution_name?: string | null;
  supervisor_name?: string | null;
  sources: CareSource[];
  sources_fetched_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyIssue {
  kind: string;
  severity: 'block' | 'warn';
  match: string;
  message: string;
}

export interface CheckIssue {
  section: string | null;
  kind: 'gap' | 'nursing_process' | 'value' | 'stale_draft' | 'review';
  message: string;
}

export interface CareStudyVersion {
  id: number;
  section_key: string;
  kind: 'notes' | 'draft' | 'edit';
  content: SectionEntries | { text: string; flagged_values?: string[]; removed_citations?: string[] };
  created_at: string;
}

export type HelpResult =
  | { kind: 'checklist'; message: string; checklist: { key: string; title: string; missing: string[] }[] }
  | { kind: 'answer'; message: string };
