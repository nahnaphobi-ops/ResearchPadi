import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Care study templates are configuration data, one JSON file per template in
 * src/blueprints/care-studies (copied to dist by scripts/copy-assets.mjs).
 * Add a college's own structure by adding a file — no code changes. Nothing
 * here encodes a college's or the Council's rules.
 */
export type FieldType = 'text' | 'textarea' | 'date' | 'datetime' | 'number';

export interface TemplateField {
  key: string;
  label: string;
  /** Plain-language explanation of what belongs in the field. */
  hint: string;
  type: FieldType;
  required?: boolean;
  /** Plausible range for number fields. Values outside it are flagged by "Check my work", never blocked. */
  min?: number;
  max?: number;
  /**
   * Leaving it empty is a valid answer (a reading that was not taken, nothing
   * extra to add), so no "[Student to supply: …]" placeholder is made for it.
   */
  blank_ok?: boolean;
}

/**
 * A chart plotted by the app (never drawn by the AI) from the student's own
 * numbers in a section's repeating entries, e.g. a partograph or vital signs.
 */
export interface ChartSpec {
  key: string;
  title: string;
  /** The repeating field holding the date or date and time of each reading. */
  time_field: string;
  /** Printed under the chart: where the original chart should be attached, etc. */
  note?: string;
  series: { field: string; label: string; min: number; max: number; step: number }[];
}

export interface TemplateSection {
  key: string;
  title: string;
  /** Heading this section falls under in the finished study, e.g. a chapter. */
  part?: string;
  /** Nursing-process stage (one of the template's stages). */
  stage: string;
  /** "Why this matters" note shown to the student. */
  why: string;
  /** How the AI should organise this section. Never a source of facts. */
  guidance: string;
  fields?: TemplateField[];
  /** Repeating entries: visits, partograph entries, problems, drugs... */
  repeat?: { label: string; min: number; fields: TemplateField[] };
  /** Length to aim for, for sections the student's entries alone do not size (e.g. a literature review). */
  word_target?: number;
  /** Charts plotted from the repeating entries. */
  charts?: ChartSpec[];
  /** Theory-only sections (e.g. literature review) need retrieved sources before drafting. */
  requires_sources?: boolean;
}

export interface CareStudyTemplate {
  id: string;
  name: string;
  description: string;
  /** Shown to the student: what the template is based on and that it is not an official format. */
  notice: string;
  focus_label: string;
  focus_hint: string;
  /** Prefix for the source search, combined with the study's focus. */
  search_terms: string;
  /** Reviewer specialty a human review of this study needs (see reviews/review-sources SPECIALTIES). */
  review_specialty?: string;
  /** nursing_process: false for stages outside the nursing process (e.g. front pages). */
  stages: { key: string; label: string; nursing_process?: boolean }[];
  sections: TemplateSection[];
}

export interface SectionEntries {
  fields?: Record<string, string>;
  items?: Record<string, string>[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '..', '..', 'blueprints', 'care-studies');

let cache: Map<string, CareStudyTemplate> | null = null;

function validate(t: CareStudyTemplate, file: string): CareStudyTemplate {
  const fail = (msg: string) => { throw new Error(`Care study template ${file}: ${msg}`); };
  if (!t.id || !t.name || !Array.isArray(t.sections) || !Array.isArray(t.stages)) fail('needs id, name, stages and sections');
  const stages = new Set(t.stages.map((s) => s.key));
  const keys = new Set<string>();
  for (const s of t.sections) {
    if (!s.key || !s.title || !s.why || !s.guidance) fail(`section ${s.key || '?'} needs key, title, why and guidance`);
    if (keys.has(s.key)) fail(`duplicate section key ${s.key}`);
    keys.add(s.key);
    if (!stages.has(s.stage)) fail(`section ${s.key} has unknown stage ${s.stage}`);
    if (!s.fields?.length && !s.repeat) fail(`section ${s.key} has no fields`);
    for (const f of [...(s.fields ?? []), ...(s.repeat?.fields ?? [])]) {
      if (!f.key || !f.label || !f.hint) fail(`a field in ${s.key} needs key, label and hint`);
    }
    for (const c of s.charts ?? []) {
      const byKey = new Map((s.repeat?.fields ?? []).map((f) => [f.key, f]));
      if (!s.repeat) fail(`chart ${c.key} in ${s.key} needs repeating entries`);
      const time = byKey.get(c.time_field);
      if (!time || (time.type !== 'date' && time.type !== 'datetime')) fail(`chart ${c.key} time_field must be a date or datetime field of ${s.key}`);
      if (!c.series?.length) fail(`chart ${c.key} in ${s.key} needs at least one series`);
      for (const ser of c.series) {
        if (byKey.get(ser.field)?.type !== 'number') fail(`chart ${c.key} series ${ser.field} must be a number field of ${s.key}`);
        if (!(ser.max > ser.min) || !(ser.step > 0)) fail(`chart ${c.key} series ${ser.field} needs min < max and a positive step`);
      }
    }
  }
  return t;
}

export function loadTemplates(dir = TEMPLATE_DIR): Map<string, CareStudyTemplate> {
  if (cache && dir === TEMPLATE_DIR) return cache;
  const map = new Map<string, CareStudyTemplate>();
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const t = validate(JSON.parse(readFileSync(join(dir, file), 'utf-8')), file);
      map.set(t.id, t);
    }
  }
  if (dir === TEMPLATE_DIR) cache = map;
  return map;
}

export const getTemplate = (id: string) => loadTemplates().get(id) ?? null;
export const listTemplates = () => [...loadTemplates().values()];

const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** Required inputs still empty; drafting stays locked until this is empty. */
export function missingRequired(section: TemplateSection, entries: SectionEntries | null | undefined, sourceCount = 0): string[] {
  const missing: string[] = [];
  const fields = entries?.fields ?? {};
  for (const f of section.fields ?? []) {
    if (f.required && !filled(fields[f.key])) missing.push(f.label);
  }
  if (section.repeat) {
    const items = entries?.items ?? [];
    if (items.length < section.repeat.min) {
      missing.push(`At least ${section.repeat.min} ${section.repeat.label.toLowerCase()} entr${section.repeat.min === 1 ? 'y' : 'ies'}`);
    }
    items.forEach((item, i) => {
      for (const f of section.repeat!.fields) {
        if (f.required && !filled(item[f.key])) missing.push(`${section.repeat!.label} ${i + 1}: ${f.label}`);
      }
    });
  }
  if (section.requires_sources && sourceCount === 0) missing.push('Sources (none found yet; try drafting again in a few minutes)');
  return missing;
}

/** Optional inputs left empty; the draft shows a placeholder for each. */
export function missingOptional(section: TemplateSection, entries: SectionEntries | null | undefined): string[] {
  const missing: string[] = [];
  const fields = entries?.fields ?? {};
  for (const f of section.fields ?? []) {
    if (!f.required && !f.blank_ok && !filled(fields[f.key])) missing.push(f.label);
  }
  (entries?.items ?? []).forEach((item, i) => {
    for (const f of section.repeat?.fields ?? []) {
      if (!f.required && !f.blank_ok && !filled(item[f.key])) missing.push(`${section.repeat!.label} ${i + 1}: ${f.label}`);
    }
  });
  return missing;
}

/** The student's entries as labelled text: the only facts a draft may use. */
export function entriesText(section: TemplateSection, entries: SectionEntries | null | undefined): string {
  const lines: string[] = [];
  const fields = entries?.fields ?? {};
  for (const f of section.fields ?? []) {
    if (filled(fields[f.key])) lines.push(`${f.label}: ${fields[f.key].trim()}`);
  }
  (entries?.items ?? []).forEach((item, i) => {
    const parts = (section.repeat?.fields ?? [])
      .filter((f) => filled(item[f.key]))
      .map((f) => `  ${f.label}: ${item[f.key].trim()}`);
    if (parts.length) lines.push(`${section.repeat!.label} ${i + 1}:`, ...parts);
  });
  return lines.join('\n');
}

/** Keep only fields the template defines, trimmed and size-capped. */
export function cleanEntries(section: TemplateSection, raw: unknown): SectionEntries {
  const input = (raw && typeof raw === 'object' ? raw : {}) as SectionEntries;
  const pick = (defs: TemplateField[], src: unknown) => {
    const out: Record<string, string> = {};
    const obj = (src && typeof src === 'object' ? src : {}) as Record<string, unknown>;
    for (const f of defs) {
      const v = obj[f.key];
      if (typeof v === 'string' && v.trim()) out[f.key] = v.slice(0, f.type === 'textarea' ? 6000 : 300);
    }
    return out;
  };
  const entries: SectionEntries = { fields: pick(section.fields ?? [], input.fields) };
  if (section.repeat) {
    entries.items = (Array.isArray(input.items) ? input.items : []).slice(0, 60).map((it) => pick(section.repeat!.fields, it));
  }
  return entries;
}

/** What is still to collect, section by section — the answer to "write the whole thing for me". */
export function studyChecklist(
  template: CareStudyTemplate,
  sections: Record<string, SectionEntries | undefined>,
  sourceCount = 0
): { key: string; title: string; missing: string[] }[] {
  return template.sections
    .map((s) => ({ key: s.key, title: s.title, missing: missingRequired(s, sections[s.key], sourceCount) }))
    .filter((s) => s.missing.length > 0);
}
