import { routeDrafting, tokensForWords } from '../ai/router.service.js';
import { findSources } from '../citations/sources.service.js';
import type { Source } from '../citations/source.types.js';
import { ensurePlaceholders, guardCitations, guardFigures, guardValues, type CareSource } from './guards.js';
import { ruleChecks, type CheckIssue } from './checks.js';
import { buildHelpPrompt, buildReviewPrompt, buildSectionPrompt, isWholeStudyRequest, rulesFor, systemPromptFor } from './prompts.js';
import {
  entriesText, isResearchProject, missingOptional, missingRequired, studyChecklist,
  type CareStudyTemplate, type SectionEntries, type TemplateSection,
} from './template.service.js';

/** The model call, injectable so the rules can be tested without one. */
export type Generate = (prompt: string, opts: { tier: 'light' | 'drafting'; maxTokens: number; action: string }) => Promise<string>;

export const defaultGenerate = (userId?: string, template?: Pick<CareStudyTemplate, 'kind'>): Generate => (prompt, opts) =>
  routeDrafting(prompt, { action: opts.action }, {
    tier: opts.tier,
    systemPrompt: opts.action === 'care-study-draft' ? systemPromptFor(template ?? {}) : rulesFor(template ?? {}),
    maxTokens: opts.maxTokens,
    userId,
  });

export interface StudySection {
  entries?: SectionEntries;
  draft?: string | null;
  drafted_at?: string | null;
  updated_at?: string | null;
}

export interface StudyContext {
  template: CareStudyTemplate;
  pseudonym: string;
  focus: string;
  sources: CareSource[];
  /** The source search has not run yet (it runs on the first draft), so theory sections are not blocked by it. */
  sourcesPending?: boolean;
  sections: Record<string, StudySection | undefined>;
}

/** How many sources to count when deciding what is still missing. */
const sourceCountFor = (ctx: StudyContext) => (ctx.sourcesPending ? Math.max(ctx.sources.length, 1) : ctx.sources.length);

/** Search results → the stored source shape. Only these may ever be cited. */
export function toCareSources(found: Source[]): CareSource[] {
  return found
    .filter((s) => s.title && s.year && s.authors.length)
    .map((s, i) => ({
      id: `S${i + 1}`,
      title: s.title,
      authors: s.authors.map((a) => (a.given ? `${a.family}, ${a.given}` : a.family)).join('; '),
      surnames: s.authors.map((a) => a.family).filter(Boolean),
      year: s.year,
      container: s.containerTitle,
      publisher: s.publisher || s.institution,
      doi: s.doi,
      url: s.url,
      snippet: s.snippet?.slice(0, 800),
      ghanaian: s.ghanaian,
    }));
}

export async function retrieveSources(template: CareStudyTemplate, focus: string): Promise<CareSource[]> {
  // Wide enough to back a full literature review.
  const found = await findSources(`${focus} ${template.search_terms}`.trim(), { limit: 30, reserve: { 'europe-pmc': 10 } });
  return toCareSources(found);
}

const sectionFacts = (ctx: StudyContext, sections: TemplateSection[]) =>
  sections
    .map((s) => {
      const text = entriesText(s, ctx.sections[s.key]?.entries);
      return text ? `${s.title}:\n${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

const EARLIER_HEAD = 8_000;
const EARLIER_TAIL = 16_000;

/**
 * Facts from sections before this one, so drafts stay consistent. When long,
 * keep the start (particulars, history) and the sections just before this one.
 */
function earlierFacts(ctx: StudyContext, section: TemplateSection): string {
  const text = sectionFacts(ctx, ctx.template.sections.slice(0, ctx.template.sections.findIndex((s) => s.key === section.key)));
  if (text.length <= EARLIER_HEAD + EARLIER_TAIL) return text;
  return `${text.slice(0, EARLIER_HEAD)}\n…\n${text.slice(-EARLIER_TAIL)}`;
}

export type DraftResult =
  | { status: 'locked'; missing: string[] }
  | { status: 'drafted'; draft: string; flaggedValues: string[]; removedCitations: string[] };

/**
 * Draft one section from the student's entries. Locked until the section's
 * required inputs are in; every gap shows as a placeholder; any clinical value
 * or citation the student and the search did not supply is flagged or removed.
 */
export async function draftSection(ctx: StudyContext, section: TemplateSection, generate: Generate): Promise<DraftResult> {
  const entries = ctx.sections[section.key]?.entries;
  const missing = missingRequired(section, entries, ctx.sources.length);
  if (missing.length) return { status: 'locked', missing };

  const optional = missingOptional(section, entries);
  const ownFacts = entriesText(section, entries);
  const prompt = buildSectionPrompt({
    template: ctx.template,
    section,
    pseudonym: ctx.pseudonym,
    focus: ctx.focus,
    entries: ownFacts,
    missingOptional: optional,
    earlierFacts: earlierFacts(ctx, section),
    sources: ctx.sources,
    targetWords: section.word_target,
  });

  // Most sections are sized by what the student entered; theory sections have a target in the template.
  const words = section.word_target ?? Math.min(3000, 400 + ownFacts.split(/\s+/).length * 3);
  const raw = (await generate(prompt, { tier: 'drafting', maxTokens: tokensForWords(words), action: 'care-study-draft' })).trim();

  // Values must come from this student's own notes (anywhere in the study, never trimmed).
  // Theory-only sections explain reference values from the sources, so they are left as written.
  const facts = `${sectionFacts(ctx, ctx.template.sections)}\n${ctx.focus}`;
  const values = section.requires_sources ? { text: raw, flagged: [] } : guardValues(raw, facts);
  // A research project's figures must also be the student's own: counts, percentages, sample sizes and table cells.
  // Sections that review the literature may quote figures from the listed sources.
  const figures = isResearchProject(ctx.template) ? guardFigures(values.text, facts, ctx.sources) : { text: values.text, flagged: [] as string[] };
  const cites = guardCitations(figures.text, ctx.sources);
  const draft = ensurePlaceholders(cites.text, optional);

  return { status: 'drafted', draft, flaggedValues: [...values.flagged, ...figures.flagged], removedCitations: cites.removed };
}

export function checklistText(ctx: StudyContext): string {
  return studyChecklist(ctx.template, Object.fromEntries(Object.entries(ctx.sections).map(([k, v]) => [k, v?.entries])), sourceCountFor(ctx))
    .map((s) => `${s.title}:\n${s.missing.map((m) => `  - ${m}`).join('\n')}`)
    .join('\n');
}

export type HelpResult =
  | { kind: 'checklist'; message: string; checklist: { key: string; title: string; missing: string[] }[] }
  | { kind: 'answer'; message: string };

/**
 * The student's help box. A request for the whole study (or a made-up patient)
 * gets a checklist of what to collect, never a paper.
 */
export async function help(ctx: StudyContext, question: string, generate: Generate): Promise<HelpResult> {
  const checklist = studyChecklist(ctx.template, Object.fromEntries(Object.entries(ctx.sections).map(([k, v]) => [k, v?.entries])), sourceCountFor(ctx));
  if (isWholeStudyRequest(question)) {
    return {
      kind: 'checklist',
      message: checklist.length
        ? isResearchProject(ctx.template)
          ? 'A research project has to be built from your own study, so ResearchPadi can\'t write it or make up results for you. Here is what to collect from your proposal, your instrument and your data. Enter it section by section and each section can then be drafted.'
          : 'A care study has to be built from your own client, so ResearchPadi can\'t write it for you. Here is what to collect from your client, her records and your notes. Enter it section by section and each section can then be drafted.'
        : 'All the required details are in. Draft each section from its own page, then use "Check my work" before you export.',
      checklist,
    };
  }
  const message = await generate(buildHelpPrompt({ template: ctx.template, question: question.slice(0, 2000), checklist: checklistText(ctx) }), {
    tier: 'light', maxTokens: 600, action: 'care-study-help',
  });
  return { kind: 'answer', message: message.trim() };
}

function studyText(ctx: StudyContext): string {
  return ctx.template.sections
    .map((s) => {
      const row = ctx.sections[s.key];
      const notes = entriesText(s, row?.entries);
      if (!notes && !row?.draft) return '';
      return `## ${s.key} — ${s.title}\nNOTES:\n${notes || '(none)'}${row?.draft ? `\nDRAFT:\n${row.draft}` : ''}`;
    })
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 60000);
}

function parseReview(text: string, keys: Set<string>): CheckIssue[] {
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
  try {
    const items = JSON.parse(json);
    if (!Array.isArray(items)) return [];
    return items
      .filter((it) => it && typeof it.message === 'string' && it.message.trim())
      .slice(0, 12)
      .map((it) => ({
        section: typeof it.section === 'string' && keys.has(it.section) ? it.section : null,
        kind: 'review' as const,
        message: it.message.trim().slice(0, 500),
      }));
  } catch {
    return [];
  }
}

/** "Check my work": rule-based checks plus an AI read-through, as questions for the student. */
export async function checkWork(ctx: StudyContext, generate: Generate): Promise<CheckIssue[]> {
  const issues = ruleChecks(ctx.template, ctx.sections, sourceCountFor(ctx));
  const text = studyText(ctx);
  if (!text) return issues;
  try {
    const raw = await generate(buildReviewPrompt({ template: ctx.template, studyText: text }), {
      tier: 'light', maxTokens: 1500, action: 'care-study-check',
    });
    issues.push(...parseReview(raw, new Set(ctx.template.sections.map((s) => s.key))));
  } catch {
    // The rule-based checks still stand on their own.
  }
  return issues;
}
