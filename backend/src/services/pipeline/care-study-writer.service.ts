import { routeDrafting, routeSupervision, tokensForWords } from '../ai/router.service.js';
import { childLogger } from '../../lib/logger.js';
import { performResearch } from './research.service.js';
import { buildReferenceList, citedSources } from './references.service.js';
import { citationKey, type PaperSource } from './paper-source.js';
import {
  CARE_STUDY_STRUCTURE, CARE_STUDY_SYSTEM_PROMPT, buildCareStudyChapterPrompt, buildCareStudyFixPrompt,
  buildCaseRecord, buildCaseValuesPrompt, checkAgainstRecord, formatCaseRecord, parseCaseValues,
  type CareStudyBrief, type CaseRecord,
} from './care-study.service.js';

const log = childLogger('care-study');

const MAX_FIX_ROUNDS = 2;

const REVIEW_SYSTEM_PROMPT = `${CARE_STUDY_SYSTEM_PROMPT}

You are now the reviewing tutor. Revise the chapter so that:
□ every fact matches the CASE RECORD exactly (names, dates, readings, results, times); remove anything not in it
□ the sections are present, numbered and in order, and the chapter starts with its heading
□ each Nursing Care Plan entry has all six labels and the diagnosis uses "related to … as evidenced by …"
□ interventions give a rationale and evaluations say whether the objective was met
□ medicines follow the MEDICINES rule exactly
□ citations come only from the SOURCES list, in exactly the form given
□ the writing is clear, third person, past tense, UK English, with no contractions
Return the complete revised chapter only.`;

function uniqueSources(list: PaperSource[]): PaperSource[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const key = (s.doi || s.title.toLowerCase()).slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function createRecord(brief: CareStudyBrief): Promise<CaseRecord> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await routeDrafting(buildCaseValuesPrompt(brief), { action: 'care-study-case' }, { maxTokens: 2500 });
    const values = parseCaseValues(raw, brief);
    if (values) return buildCaseRecord(brief, values);
    log.warn({ attempt }, 'Case values were not usable; asking again');
  }
  throw new Error('Could not create a consistent case record');
}

/** Write, review, then check one chapter against the record and fix what disagrees. */
async function writeChapter(
  chapter: (typeof CARE_STUDY_STRUCTURE)[number],
  record: CaseRecord,
  recordText: string,
  sourceLines: string[],
  previous: string,
  institution?: string,
): Promise<string> {
  const maxTokens = tokensForWords(Math.ceil(chapter.wordTarget * 1.25));
  const prompt = buildCareStudyChapterPrompt({ chapter, record: recordText, sources: sourceLines, previous, institution });
  let text = await routeDrafting(prompt, { action: 'care-study-chapter' }, { systemPrompt: CARE_STUDY_SYSTEM_PROMPT, maxTokens });

  try {
    const reviewed = await routeSupervision(
      `${prompt}\n\nCHAPTER TO REVISE:\n${text}`,
      { systemPrompt: REVIEW_SYSTEM_PROMPT, maxTokens, meta: { action: 'care-study-review', chapter: chapter.num } },
    );
    if (!reviewed.truncated && reviewed.text.trim()) text = reviewed.text.trim();
  } catch (err) {
    log.warn({ chapter: chapter.num, err: (err as Error).message }, 'Care study review failed; keeping the draft');
  }

  let issues = checkAgainstRecord(text, record);
  for (let round = 1; round <= MAX_FIX_ROUNDS && issues.length; round++) {
    log.info({ chapter: chapter.num, round, issues: issues.length }, 'Fixing facts that disagree with the case record');
    const fixed = await routeDrafting(buildCareStudyFixPrompt(text, issues, recordText), { action: 'care-study-fix' }, { systemPrompt: CARE_STUDY_SYSTEM_PROMPT, maxTokens });
    const fixedIssues = checkAgainstRecord(fixed, record);
    if (fixed.trim() && fixedIssues.length < issues.length) {
      text = fixed.trim();
      issues = fixedIssues;
    } else {
      break;
    }
  }
  if (issues.length) log.warn({ chapter: chapter.num, issues }, 'Care study chapter still disagrees with the case record');
  return text;
}

export interface CareStudyResult {
  title: string;
  content: string;
  sources: PaperSource[];
  record: CaseRecord;
}

export async function writeCareStudy(
  brief: CareStudyBrief,
  opts: { institution?: string; onProgress: (step: string, percent: number) => Promise<void> },
): Promise<CareStudyResult> {
  await opts.onProgress('Creating the case record...', 5);
  const record = await createRecord(brief);
  const recordText = formatCaseRecord(record);

  await opts.onProgress('Finding sources on the condition...', 12);
  const research = await performResearch(`${brief.caseFocus} midwifery care`);
  const sources = uniqueSources([...research.ghanaian.map((g) => g.source), ...research.citations]).slice(0, 25);
  const sourceLines = sources.map((s) => `${citationKey(s)} — ${s.title}`);

  const chapters: string[] = [];
  for (const [i, chapter] of CARE_STUDY_STRUCTURE.entries()) {
    await opts.onProgress(`Writing and checking Chapter ${chapter.num}...`, 20 + i * 18);
    chapters.push(await writeChapter(chapter, record, recordText, sourceLines, chapters.join('\n\n'), opts.institution));
  }

  await opts.onProgress('Assembling...', 90);
  const body = chapters.join('\n\n');
  const cited = citedSources(body, sources);
  const references = cited.length ? `\n\n${buildReferenceList(cited)}` : '';
  return {
    title: `A Client/Family Centred Maternity Care Study on Madam ${record.values.client.name}`,
    content: `${body}${references}`,
    sources,
    record,
  };
}
