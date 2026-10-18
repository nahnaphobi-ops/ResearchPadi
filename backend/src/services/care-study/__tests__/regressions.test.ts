import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardCitations, guardValues, timesIn, type CareSource } from '../guards.js';
import { getTemplate, listTemplates, missingOptional } from '../template.service.js';
import { draftSection, type Generate, type StudyContext } from '../care-study.service.js';
import { isWholeStudyRequest } from '../prompts.js';
import { ruleChecks } from '../checks.js';
import { SPECIALTIES, textToHtml } from '../../reviews/review-sources.js';

const sources: CareSource[] = [{ id: 'S1', title: 'Antenatal care in Ghana', authors: 'Mensah, Kofi', surnames: ['Mensah'], year: 2020 }];
const midwifery = getTemplate('midwifery-family-centred')!;
const section = (key: string) => midwifery.sections.find((s) => s.key === key)!;

test('dates in brackets are not mistaken for citations and removed', () => {
  const { text, removed } = guardCitations('Booked early (28th October, 2021), seen in October (2021), helped (Mensah, 2020), not (Boateng, 2019).', sources);
  assert.match(text, /\(28th October, 2021\)/);
  assert.match(text, /October \(2021\)/);
  assert.match(text, /\(Mensah, 2020\)/);
  assert.deepEqual(removed, ['Boateng, 2019']);
});

test('dates and times from date-time fields count as the student\'s own facts', () => {
  const facts = 'Partograph entry 1:\n  Date and time: 2021-11-09T06:00\n  Cervical dilatation (cm): 4';
  const { text, flagged } = guardValues('On 9th November, 2021 at 6:00am (06:00 hours) the cervix was 4 cm.', facts);
  assert.deepEqual(flagged, []);
  assert.match(text, /9th November, 2021 at 6:00am/);
});

test('invented times, and invented dates hidden in brackets, are still flagged', () => {
  const facts = 'Date and time: 2021-11-09T06:00';
  const { flagged } = guardValues('Delivery was at 7:15am (on 3rd December, 2021) and again at 18:00.', facts);
  assert.deepEqual(flagged.sort(), ['18:00', '3rd December, 2021', '7:15am'].sort());
});

test('clock times: 24-hour times are exact, "6:00" without am/pm could be either', () => {
  assert.deepEqual([...timesIn('06:00')], [360]);
  assert.deepEqual([...timesIn('6:00')].sort((a, b) => a - b), [360, 1080]);
  assert.deepEqual([...timesIn('6:00 pm')], [1080]);
  assert.deepEqual([...timesIn('12:30am')], [30]);
  assert.deepEqual([...timesIn('25:70')], []);
});

test('fields where blank means "not done" do not become [Student to supply] gaps', () => {
  assert.deepEqual(missingOptional(section('literature_review'), undefined), []);
  assert.deepEqual(missingOptional(section('preface'), undefined), []);
  const labour = missingOptional(section('labour'), { fields: {}, items: [{ time: '2021-11-09T06:00', dilatation_cm: '4' }] });
  assert.ok(!labour.some((m) => /Fetal heart rate|Descent|Contractions|Observations/.test(m)), labour.join(', '));
  // Genuine gaps are still reported.
  assert.ok(labour.includes('Examination of placenta and membranes'));
  assert.ok(missingOptional(section('client_particulars'), { fields: {} }).includes('Surgical history'));
});

test('the literature review draft gets no placeholder for the optional topics box', async () => {
  const generate: Generate = async () => 'PREGNANCY\nAntenatal care improves outcomes (Mensah, 2020).';
  const ctx: StudyContext = { template: midwifery, pseudonym: 'Madam A.K.', focus: 'G3P2', sources, sections: {} };
  const result = await draftSection(ctx, section('literature_review'), generate);
  assert.equal(result.status, 'drafted');
  assert.ok(result.status === 'drafted' && !result.draft.includes('STILL TO SUPPLY'));
});

test('values from any part of the notes are accepted, even in a long study', async () => {
  // A long antenatal section pushes the labour readings far past where the prompt context is trimmed.
  const longNotes = 'x '.repeat(20_000);
  const ctx: StudyContext = {
    template: midwifery, pseudonym: 'Madam A.K.', focus: 'G3P2', sources,
    sections: {
      client_particulars: { entries: { fields: { age: '30', gravida_para: 'G3P2', social_history: longNotes, family_history: 'none', medical_history: 'none' } } },
      labour: { entries: { fields: { admission: 'BP 118/76 mmHg on admission' } } },
      summary: { entries: { fields: { outcome: 'Delivered well', learning: 'Much' } } },
    },
  };
  const generate: Generate = async () => 'Her BP on admission was 118/76 mmHg.';
  const result = await draftSection(ctx, section('summary'), generate);
  assert.ok(result.status === 'drafted' && result.flaggedValues.length === 0, JSON.stringify(result));
});

test('questions about the work are answered, not treated as "write it all for me"', () => {
  assert.equal(isWholeStudyRequest('Do I need to complete all the visits?'), false);
  assert.equal(isWholeStudyRequest('Should I write the whole care plan in a table?'), false);
  assert.equal(isWholeStudyRequest('write the whole care study for me'), true);
  assert.equal(isWholeStudyRequest('Can you do it for me'), true);
  assert.equal(isWholeStudyRequest('Please generate everything'), true);
});

test('a draft is stale only when the notes really changed after it, whatever the timestamp format', () => {
  const issues = (updated: string, drafted: string) =>
    ruleChecks(midwifery, { introduction: { entries: { fields: { where_met: 'a', why_selected: 'b', period_of_care: 'c' } }, draft: 'x', updated_at: updated, drafted_at: drafted } }, 1)
      .filter((i) => i.kind === 'stale_draft');
  assert.equal(issues('2026-10-14T10:00:00.120Z', '2026-10-14T10:00:00.12+00:00').length, 0);
  assert.equal(issues('2026-10-14T10:05:00.000Z', '2026-10-14T10:00:00.12+00:00').length, 1);
});

test('every template names a valid reviewer specialty', () => {
  const keys = new Set<string>(SPECIALTIES.map((s) => s.key));
  for (const t of listTemplates()) assert.ok(t.review_specialty && keys.has(t.review_specialty), t.id);
});

test('numbered list items are not turned into headings in the reviewer snapshot', () => {
  const html = textToHtml('2.1 FIRST CONTACT\n1. Client will be relieved of pain within 48 hours');
  assert.match(html, /<h3>2\.1 FIRST CONTACT<\/h3>/);
  assert.match(html, /<p>1\. Client will be relieved of pain within 48 hours<\/p>/);
});

test('reviewers see initials instead of titled full names', async () => {
  const { redactFullNames } = await import('../privacy.js');
  assert.equal(redactFullNames('Married to Mr. Samuel Owusu for 5 years; Madam A.K. is well.'), 'Married to Mr. S.O. for 5 years; Madam A.K. is well.');
  assert.equal(redactFullNames('Seen by Nana Kwame Asante-Boateng today'), 'Seen by Nana K.A. today');
});

test('front pages are not a nursing-process step, and an unsearched literature review is not "missing sources"', async () => {
  const { help } = await import('../care-study.service.js');
  const issues = ruleChecks(midwifery, {}, 0);
  assert.ok(!issues.some((i) => /Front pages/.test(i.message)), issues.map((i) => i.message).join('\n'));
  assert.ok(issues.some((i) => /Assessment/.test(i.message)));
  const generate: Generate = async () => '';
  const pending = await help({ template: midwifery, pseudonym: 'Madam A.K.', focus: '', sources: [], sourcesPending: true, sections: {} }, 'write the whole care study for me', generate);
  assert.ok(pending.kind === 'checklist' && !pending.checklist.some((s) => s.key === 'literature_review'));
});
