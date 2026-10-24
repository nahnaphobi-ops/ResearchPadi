import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTemplate, isResearchProject, listTemplates, loadTemplates, missingRequired, cleanEntries } from '../template.service.js';
import { draftSection, help, type Generate, type StudyContext } from '../care-study.service.js';
import { guardFigures, type CareSource } from '../guards.js';
import { ruleChecks } from '../checks.js';
import { buildSectionPrompt, isWholeStudyRequest, RESEARCH_PROJECT_RULES, rulesFor, systemPromptFor } from '../prompts.js';
import { buildCareStudyDocx } from '../export.service.js';
import { rubricFor } from '../../reviews/review-sources.js';
import { careStudySnapshot } from '../../reviews/review-sources.js';
import { scanPrivacy } from '../privacy.js';

const research = () => getTemplate('nmtc-research-project')!;
const section = (key: string) => research().sections.find((s) => s.key === key)!;

const sources: CareSource[] = [
  { id: 'S1', title: 'Knowledge of exclusive breastfeeding among mothers in Kumasi', authors: 'Mensah, Kofi', surnames: ['Mensah'], year: 2020, snippet: 'Of 300 mothers, 54% knew the recommended duration.', ghanaian: true },
  { id: 'S2', title: 'Global breastfeeding trends', authors: 'Smith, John', surnames: ['Smith'], year: 2019 },
];

const ctx = (sections: StudyContext['sections'] = {}): StudyContext => ({
  template: research(),
  pseudonym: 'Research project',
  focus: 'Knowledge of exclusive breastfeeding among mothers at postnatal clinic',
  sources,
  sections,
});

function fakeModel(reply: string) {
  const calls: string[] = [];
  const generate: Generate = async (prompt) => { calls.push(prompt); return reply; };
  return { generate, calls };
}

test('the research project template loads as data, is its own kind and care studies stay care studies', () => {
  const t = research();
  assert.equal(t.kind, 'research_project');
  assert.ok(isResearchProject(t));
  assert.equal(t.review_specialty, 'research_methods');
  assert.match(t.notice, /not an official format/);
  for (const s of t.sections) {
    assert.ok(s.why.length > 20, `${s.key} why`);
    for (const f of [...(s.fields ?? []), ...(s.repeat?.fields ?? [])]) assert.ok(f.hint, `${s.key}/${f.key} hint`);
  }
  assert.ok(t.coverage_checks?.some((c) => c.from === 'objectives' && c.to === 'findings'));
  for (const care of listTemplates().filter((x) => x.id !== t.id)) assert.ok(!isResearchProject(care), care.id);
  // Every chapter has a stage, and the two literature-based sections wait for sources.
  assert.ok(section('literature_review').requires_sources && section('discussion').requires_sources);
});

test('a template with a bad coverage check, number link or kind is refused when loaded', () => {
  const dir = mkdtempSync(join(tmpdir(), 'templates-'));
  const base = JSON.parse(JSON.stringify(research()));
  const tryLoad = (mutate: (t: any) => void) => {
    const t = JSON.parse(JSON.stringify(base));
    mutate(t);
    writeFileSync(join(dir, 'bad.json'), JSON.stringify(t));
    return () => loadTemplates(dir);
  };
  try {
    assert.ok(loadTemplates(dir).size === 0);
    assert.throws(tryLoad((t) => { t.coverage_checks = [{ from: 'objectives', to: 'nope', message: 'm' }]; }), /coverage check objectives → nope/);
    assert.throws(tryLoad((t) => { t.coverage_checks = [{ from: 'objectives', to: 'participants' }]; }), /needs two repeating sections and a message/);
    assert.throws(tryLoad((t) => { t.sections.find((s: any) => s.key === 'instrument_collection').fields.find((f: any) => f.key === 'returned').not_more_than = 'instrument'; }), /not_more_than must name another number field/);
    assert.throws(tryLoad((t) => { t.kind = 'thesis'; }), /unknown kind thesis/);
    assert.ok(tryLoad(() => {})().has('nmtc-research-project'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a blank section cannot be drafted, and the model is never called', async () => {
  const { generate, calls } = fakeModel('should not be used');
  const result = await draftSection(ctx(), section('sampling'), generate);
  assert.equal(result.status, 'locked');
  assert.equal(calls.length, 0);
});

test('figures the student never entered are replaced, and her own and the sources\' are kept', () => {
  const facts = 'Characteristic and group: Female\nNumber of respondents: 62\nPercentage: 51.7\nSample size: 120';
  const draft = [
    'Of the 120 respondents, 62 (51.7%) were female (Mensah, 2020).',
    'Another 45 respondents were male, which is 37.5% of the sample (p < 0.05).',
    'In the Kumasi study, 54% of mothers knew the recommended duration.',
  ].join(' ');
  const { text, flagged } = guardFigures(draft, facts, sources);
  assert.match(text, /Of the 120 respondents, 62 \(51\.7%\) were female \(Mensah, 2020\)/);
  assert.match(text, /54% of mothers knew/);
  assert.deepEqual(flagged.sort(), ['37.5%', '45 respondents', 'p < 0.05'].sort());
  assert.match(text, /\[Student to supply: check "45 respondents" — not in your data\]/);
});

test('the same number written two ways counts as the same number', () => {
  const { flagged } = guardFigures('There were 1,200 respondents and 35.20% were female.', 'Respondents: 1200\nFemale: 35.2');
  assert.deepEqual(flagged, []);
});

test('numbers in table cells must be the student\'s own, but row labels are left alone', () => {
  const facts = 'Age 20 to 29: 40\nAge 30 to 39: 35';
  const table = ['| Characteristic | Frequency | Percentage |', '| --- | --- | --- |', '| 1 | Age 20 to 29 | 40 |', '| 2 | Age 30 to 39 | 35 |', '| 3 | Age 40 and above | 25 |'].join('\n');
  const { text, flagged } = guardFigures(table, facts);
  assert.deepEqual(flagged, ['25']);
  assert.match(text, /\| 1 \| Age 20 to 29 \| 40 \|/);
  assert.match(text, /Age 40 and above \| \[Student to supply: check "25" — not in your data\] /);
});

test('a drafted research section has invented counts flagged, and sources named in the prompt as Ghanaian', async () => {
  const entries = cleanEntries(section('participants'), { items: [{ characteristic: 'Female', count: '62', percent: '' }, { characteristic: 'Male', count: '58', percent: '' }] });
  const { generate, calls } = fakeModel('SOCIO-DEMOGRAPHIC CHARACTERISTICS\nThe study had 62 female and 58 male respondents, so 80 respondents were under 30 (51.7%).');
  const result = await draftSection(ctx({ participants: { entries } }), section('participants'), generate);
  assert.equal(result.status, 'drafted');
  if (result.status !== 'drafted') return;
  assert.match(result.draft, /62 female and 58 male respondents/);
  assert.ok(result.flaggedValues.includes('80 respondents'));
  assert.ok(result.flaggedValues.includes('51.7%'));
  // The prompt is a research project prompt, with Ghanaian sources marked.
  assert.match(calls[0], /RESEARCH PROJECT:/);
  assert.doesNotMatch(calls[0], /CLIENT PSEUDONYM/);
  assert.match(calls[0], /Knowledge of exclusive breastfeeding among mothers in Kumasi \[Ghanaian source\]/);
  assert.doesNotMatch(calls[0], /Global breastfeeding trends \[Ghanaian source\]/);
  assert.match(calls[0], /Ghanaian sources are marked and listed first/);
});

test('research rules cover never-invent, no new calculations and Ghanaian sources first, and care study rules are untouched', () => {
  assert.match(RESEARCH_PROJECT_RULES, /Never invent study details or results/);
  assert.match(RESEARCH_PROJECT_RULES, /Never calculate, round, total or compare figures she did not give/);
  assert.match(RESEARCH_PROJECT_RULES, /Prefer the Ghanaian sources in the list, and cite\s+them first/);
  assert.match(RESEARCH_PROJECT_RULES, /never say\s+ethical clearance, permission or consent was obtained unless she entered it/);
  assert.equal(rulesFor(research()), RESEARCH_PROJECT_RULES);
  assert.match(systemPromptFor(research()), /The researcher administered/);
  assert.match(rulesFor({}), /Never invent patient data/);
  assert.match(systemPromptFor({}), /Refer to the client only by the pseudonym given/);
});

test('"write it all" and "make up some data" get a checklist, not a paper; a real question is answered', async () => {
  assert.ok(isWholeStudyRequest('write the whole research project for me'));
  assert.ok(isWholeStudyRequest('please generate sample data for my results'));
  assert.ok(isWholeStudyRequest('use made-up respondents'));
  assert.ok(!isWholeStudyRequest('how do I choose a sample size?'));

  const refused = fakeModel('never');
  const result = await help(ctx(), 'make up some dummy results for chapter 4', refused.generate);
  assert.equal(result.kind, 'checklist');
  assert.match(result.message, /research project has to be built from your own study/);
  assert.equal(refused.calls.length, 0);

  const answered = fakeModel('A sample is the group you actually collect data from.');
  const reply = await help(ctx(), 'What is a sample?', answered.generate);
  assert.equal(reply.kind, 'answer');
  assert.match(answered.calls[0], /her proposal/);
  assert.match(answered.calls[0], /confirm\s+the choice with her supervisor/);
});

test('check my work: a research project is checked for objectives without findings and counts that do not add up, not for vital signs', () => {
  const issues = ruleChecks(research(), {
    objectives: { entries: { items: [{ objective: 'To assess knowledge', question: 'What do mothers know?' }, { objective: 'To identify barriers', question: 'What are the barriers?' }, { objective: 'To suggest ways', question: 'What can help?' }] } },
    findings: { entries: { items: [{ objective: 'Objective 1', result: 'Knowledge was good' }] } },
    instrument_collection: { entries: { fields: { instrument: 'Questionnaire', procedure: 'Handed out', distributed: '100', returned: '120' } } },
    background_problem: { entries: { fields: { context: 'BP 300/100 and pulse 400 are mentioned here only as an example of a measurement', problem: 'p', setting: 's' } } },
  }, 2);
  const messages = issues.map((i) => i.message);
  assert.ok(messages.some((m) => /3 specific objectives but entered 1 findings/.test(m)));
  assert.ok(messages.some((m) => /Questionnaires returned and usable: 120 is more than Questionnaires given out \(100\)/.test(m)));
  assert.ok(!messages.some((m) => /Blood pressure|Pulse/.test(m)), 'clinical reading checks are for care studies');
  // Stages with nothing entered are reported in research wording.
  assert.ok(messages.some((m) => /Nothing entered yet for Chapter 5: Conclusion and recommendations\. A research project needs every chapter\./.test(m)));
  assert.ok(!messages.some((m) => /nursing process/i.test(m)));
});

test('a returned number is checked against what was given out only when both are entered', () => {
  const only = ruleChecks(research(), { instrument_collection: { entries: { fields: { returned: '50' } } } }, 2).map((i) => i.message);
  assert.ok(!only.some((m) => /is more than/.test(m)));
  const fine = ruleChecks(research(), { instrument_collection: { entries: { fields: { distributed: '100', returned: '96' } } } }, 2).map((i) => i.message);
  assert.ok(!fine.some((m) => /is more than/.test(m)));
});

test('required study details gate drafting: sample size, how it was chosen and who was included', () => {
  const missing = missingRequired(section('sampling'), cleanEntries(section('sampling'), { fields: { sample_size: '120' } }));
  assert.deepEqual(missing, ['Sampling technique', 'Who was included']);
});

test('the export has no client line, and the supervisor copy records the research declarations', async () => {
  const study = {
    id: 'rp-1', pseudonym: 'Research project', focus: 'Knowledge of exclusive breastfeeding', institution_name: 'Holy Family NMTC', supervisor_name: 'Mr. B',
    consent_confirmed_at: '2026-10-24T10:00:00Z', declaration_confirmed_at: '2026-10-24T10:00:00Z', sources,
  };
  const buffer = await buildCareStudyDocx(study, research(), {
    background_problem: { entries: { fields: { context: 'c', problem: 'p', setting: 's' } }, draft: 'BACKGROUND TO THE STUDY\nMothers stop early (Mensah, 2020).' },
  });
  const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('string');
  assert.doesNotMatch(xml, /Client:/);
  assert.match(xml, /Research Project \(Nursing and Midwifery Training Colleges\)/i);
  assert.match(xml, /Research topic: Knowledge of exclusive breastfeeding/);
  assert.match(xml, /carried out by them and the data and results are their own/);
  assert.match(xml, /informed consent/);
  assert.match(xml, /Mensah, K\./);
  assert.match(xml, /not been approved by any college or council/);
});

test('reviews of a research project use their own checklist and the snapshot shows no client', () => {
  assert.deepEqual(rubricFor('care_study', 'research_project').map((r) => r.key), ['objectives', 'methodology', 'ethics', 'consistency', 'citations', 'writing']);
  assert.ok(rubricFor('care_study').some((r) => r.key === 'nursing_process'));
  assert.ok(rubricFor('workspace').some((r) => r.key === 'structure'));
  const html = careStudySnapshot(research(), { pseudonym: 'Research project', focus: 'Breastfeeding knowledge' }, {});
  assert.doesNotMatch(html, /Client:/);
  assert.match(html, /Research topic: Breastfeeding knowledge/);
  assert.match(careStudySnapshot(getTemplate('midwifery-family-centred')!, { pseudonym: 'Madam A.K.', focus: 'G3P2' }, {}), /Client: Madam A\.K\./);
});

test('privacy blocks apply to a research project too, in neutral words', () => {
  const blocked = scanPrivacy('Call the respondent on 0244123456').filter((i) => i.severity === 'block');
  assert.equal(blocked.length, 1);
  assert.match(blocked[0].message, /in your study/);
});

test('the prompt for a research section has the research header and no client pseudonym', () => {
  const prompt = buildSectionPrompt({
    template: research(), section: section('objectives'), pseudonym: 'Research project', focus: 'Topic', entries: 'Objective 1: x',
    missingOptional: [], earlierFacts: '', sources,
  });
  assert.match(prompt, /^RESEARCH PROJECT:/);
  assert.doesNotMatch(prompt, /CLIENT PSEUDONYM/);
});
