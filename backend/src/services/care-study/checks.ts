import type { CareStudyTemplate, SectionEntries, TemplateField, TemplateSection } from './template.service.js';
import { collectText } from './privacy.js';
import { isResearchProject, missingRequired } from './template.service.js';

/**
 * Rule-based part of "Check my work". It points at gaps and values that look
 * wrong and asks the student to confirm them with the supervisor. It never
 * decides what is clinically right.
 */
export interface CheckIssue {
  section: string | null;
  kind: 'gap' | 'nursing_process' | 'value' | 'stale_draft' | 'review';
  message: string;
}

const CONFIRM = 'Please check your records and confirm it with your supervisor.';

interface Range { name: string; re: RegExp; min: number; max: number; unit: string }

// Wide plausibility limits: values outside them are almost always typing
// mistakes. Values inside them are not judged.
const RANGES: Range[] = [
  { name: 'Temperature', re: /\b(?:temp(?:erature)?|T)\b\s*[:=-]?\s*(\d{2}(?:\.\d+)?)\s*(?:°|º)?\s*C?\b/gi, min: 33, max: 43, unit: '°C' },
  { name: 'Pulse', re: /\b(?:pulse|PR|(?<!(?:fetal|foetal)\s)heart rate)\b\s*[:=-]?\s*(\d{2,3})\b/gi, min: 30, max: 220, unit: 'beats/min' },
  { name: 'Respiration', re: /\b(?:resp(?:iration)?s?|RR)\s*[:=-]?\s*(\d{1,3})\b/gi, min: 6, max: 70, unit: 'breaths/min' },
  { name: 'Fetal heart rate', re: /\b(?:FHR|fetal heart(?:\s*rate)?|foetal heart(?:\s*rate)?)\s*[:=-]?\s*(\d{2,3})\b/gi, min: 60, max: 220, unit: 'beats/min' },
  { name: 'Haemoglobin', re: /\b(?:Hb|ha?emoglobin)(?:\s*level)?\s*[:=-]?\s*(\d{1,2}(?:\.\d+)?)\s*(?:g|gm|gms)?\s*\/?\s*d?l?\b/gi, min: 3, max: 22, unit: 'g/dl' },
  { name: 'Gestation', re: /(\d{1,2})\s*(?:\+\s*\d\s*)?(?:weeks?|wks?)\b/gi, min: 4, max: 44, unit: 'weeks' },
  { name: 'APGAR score', re: /APGAR[^0-9\n]{0,30}(\d{1,2})\b/gi, min: 0, max: 10, unit: '' },
];

const BP = /\b(?:BP|blood pressure)\s*[:=-]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/gi;

export function valueIssues(text: string): string[] {
  const out: string[] = [];
  for (const r of RANGES) {
    for (const m of text.matchAll(r.re)) {
      const v = Number(m[1]);
      if (Number.isFinite(v) && (v < r.min || v > r.max)) {
        out.push(`${r.name} "${m[0].trim()}" looks unusual (${v}${r.unit ? ` ${r.unit}` : ''}).`);
      }
    }
  }
  for (const m of text.matchAll(BP)) {
    const sys = Number(m[1]);
    const dia = Number(m[2]);
    if (sys <= dia) out.push(`Blood pressure "${m[0].trim()}": the top number should be higher than the bottom one.`);
    else if (sys < 60 || sys > 260 || dia < 30 || dia > 160) out.push(`Blood pressure "${m[0].trim()}" looks unusual.`);
  }
  return out;
}

const isoDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?$/.test(v) ? v.replace(' ', 'T') : null);

/** Numbers outside the range the template calls plausible, as questions for the student. */
function rangeIssues(section: TemplateSection, entries: SectionEntries | undefined): string[] {
  const out: string[] = [];
  const test = (field: TemplateField, value: string | undefined, where: string, group: TemplateField[], valueOf: (key: string) => string | undefined) => {
    if (field.type !== 'number' || value === undefined || value.trim() === '') return;
    const n = Number(value);
    if (!Number.isFinite(n)) { out.push(`${where}${field.label}: "${value}" is not a number.`); return; }
    if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
      out.push(`${where}${field.label}: ${n} looks unusual (expected about ${field.min ?? '…'} to ${field.max ?? '…'}).`);
    }
    // A part cannot be bigger than its whole (questionnaires returned of those given out).
    const other = field.not_more_than ? valueOf(field.not_more_than) : undefined;
    if (field.not_more_than && other !== undefined && other.trim() !== '' && Number.isFinite(Number(other)) && n > Number(other)) {
      out.push(`${where}${field.label}: ${n} is more than ${group.find((g) => g.key === field.not_more_than)?.label ?? field.not_more_than} (${Number(other)}).`);
    }
  };
  for (const f of section.fields ?? []) test(f, entries?.fields?.[f.key], '', section.fields ?? [], (k) => entries?.fields?.[k]);
  (entries?.items ?? []).forEach((item, i) => {
    for (const f of section.repeat?.fields ?? []) test(f, item[f.key], `${section.repeat!.label} ${i + 1}, `, section.repeat!.fields, (k) => item[k]);
  });
  return out;
}

export function ruleChecks(
  template: CareStudyTemplate,
  sections: Record<string, { entries?: SectionEntries; draft?: string | null; drafted_at?: string | null; updated_at?: string | null } | undefined>,
  sourceCount: number
): CheckIssue[] {
  const issues: CheckIssue[] = [];

  for (const s of template.sections) {
    const row = sections[s.key];
    const missing = missingRequired(s, row?.entries, sourceCount);
    if (missing.length) {
      issues.push({ section: s.key, kind: 'gap', message: `${s.title}: still needs ${missing.join('; ')}.` });
    }

    // The clinical reading checks (blood pressure, pulse…) only make sense in a care study.
    for (const v of isResearchProject(template) ? [] : valueIssues(collectText(row?.entries))) {
      issues.push({ section: s.key, kind: 'value', message: `${s.title}: ${v} ${CONFIRM}` });
    }

    for (const message of rangeIssues(s, row?.entries)) {
      issues.push({ section: s.key, kind: 'value', message: `${s.title}: ${message} ${CONFIRM}` });
    }

    // Repeating entries (visits, days, partograph readings) should be in date and time order.
    const timeField = s.repeat?.fields.find((f) => f.type === 'date' || f.type === 'datetime')?.key;
    const dates = timeField ? (row?.entries?.items ?? []).map((it) => isoDate(it[timeField])).filter((d): d is string => !!d) : [];
    if (dates.some((d, i) => i > 0 && d < dates[i - 1])) {
      issues.push({ section: s.key, kind: 'value', message: `${s.title}: the dates are not in order. Check that each entry has the right date. ${CONFIRM}` });
    }

    // Compare as times: the database and the API write timestamps in different formats.
    if (row?.draft && row.drafted_at && row.updated_at && Date.parse(row.updated_at) > Date.parse(row.drafted_at)) {
      issues.push({ section: s.key, kind: 'stale_draft', message: `${s.title}: you changed your notes after this was drafted. Draft it again so it matches.` });
    }
  }

  // Each nursing-process stage should have something entered.
  for (const stage of template.stages) {
    if (stage.nursing_process === false) continue;
    const inStage = template.sections.filter((s) => s.stage === stage.key);
    if (inStage.length && inStage.every((s) => !collectText(sections[s.key]?.entries).trim())) {
      issues.push({
        section: null,
        kind: 'nursing_process',
        message: isResearchProject(template)
          ? `Nothing entered yet for ${stage.label}. A research project needs every chapter.`
          : `Nothing entered yet for ${stage.label}. The nursing process needs every step.`,
      });
    }
  }

  // Each objective needs a finding, and similar pairings the template names.
  for (const c of template.coverage_checks ?? []) {
    const count = (key: string) => (sections[key]?.entries?.items ?? []).length;
    const from = count(c.from);
    const to = count(c.to);
    if (from > 0 && to > 0 && from > to) {
      issues.push({ section: c.to, kind: 'gap', message: c.message.replace('{from}', String(from)).replace('{to}', String(to)) });
    }
  }

  return issues;
}
