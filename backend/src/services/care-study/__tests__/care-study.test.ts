import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { listTemplates, getTemplate, missingRequired, cleanEntries } from '../template.service.js';
import { draftSection, help, checkWork, type Generate, type StudyContext } from '../care-study.service.js';
import { checkPseudonym, scanPrivacy } from '../privacy.js';
import { guardCitations, guardValues, ensurePlaceholders, type CareSource } from '../guards.js';
import { buildCareStudyDocx } from '../export.service.js';
import { valueIssues } from '../checks.js';

const midwifery = () => getTemplate('midwifery-family-centred')!;
const section = (key: string) => midwifery().sections.find((s) => s.key === key)!;

const sources: CareSource[] = [
  { id: 'S1', title: 'Antenatal care attendance in Ghana', authors: 'Mensah, Kofi; Owusu, Ama', surnames: ['Mensah', 'Owusu'], year: 2020 },
];

const ctx = (sections: StudyContext['sections'] = {}): StudyContext => ({
  template: midwifery(),
  pseudonym: 'Madam A.K.',
  focus: 'G3P2 at 37 weeks',
  sources,
  sections,
});

/** A model stand-in that records whether it was called. */
function fakeModel(reply: string) {
  const calls: string[] = [];
  const generate: Generate = async (prompt) => { calls.push(prompt); return reply; };
  return { generate, calls };
}

test('templates load from data files, and every section has hints and a "why this matters" note', () => {
  const all = listTemplates();
  assert.ok(all.length >= 2);
  for (const t of all) {
    for (const s of t.sections) {
      assert.ok(s.why.length > 20, `${t.id}/${s.key} why`);
      for (const f of [...(s.fields ?? []), ...(s.repeat?.fields ?? [])]) assert.ok(f.hint, `${t.id}/${s.key}/${f.key} hint`);
    }
  }
});

// Acceptance 1
test('a blank section cannot be drafted, and the model is never called', async () => {
  const { generate, calls } = fakeModel('should not be used');
  const result = await draftSection(ctx(), section('antenatal_visits'), generate);
  assert.equal(result.status, 'locked');
  assert.ok(result.status === 'locked' && result.missing.length > 0);
  assert.equal(calls.length, 0);
});

// Acceptance 2
test('a half-filled section gets a placeholder for every missing item and no invented values', async () => {
  const entries = cleanEntries(section('antenatal_visits'), {
    items: [{ date: '2021-10-28', type: 'First contact at ANC clinic', findings: 'BP 110/70 mmHg, fundal height 36cm, FHR 140 bpm', care_given: 'Gave folic acid 5mg' }],
  });
  assert.deepEqual(missingRequired(section('antenatal_visits'), entries), []);

  // The "model" invents a BP, a weight and a date, cites an unknown source, and skips the placeholders.
  const { generate, calls } = fakeModel([
    '2.1 FIRST CONTACT WITH THE CLIENT',
    'On 28th October, 2021 the client was seen. Her BP was 110/70 mmHg and fundal height 36 cm.',
    'On her next visit on 4th November, 2021 her BP was 140/90 mmHg and she weighed 72 kg.',
    'Folic acid prevents neural tube defects (Boateng, 2018) and antenatal care improves outcomes (Mensah et al., 2020).',
  ].join('\n'));
  const result = await draftSection(ctx({ antenatal_visits: { entries } }), section('antenatal_visits'), generate);
  assert.equal(result.status, 'drafted');
  if (result.status !== 'drafted') return;

  assert.equal(calls.length, 1);
  assert.match(calls[0], /BP 110\/70 mmHg/);

  // Her own values survive; invented ones do not.
  assert.match(result.draft, /110\/70 mmHg/);
  assert.match(result.draft, /28th October, 2021/);
  assert.doesNotMatch(result.draft.replace(/\[Student to supply:[^\]]*\]/g, ''), /140\/90|72 kg|4th November/);
  assert.deepEqual(result.flaggedValues.sort(), ['140/90 mmHg', '4th November, 2021', '72 kg'].sort());

  // Only the retrieved source may be cited.
  assert.match(result.draft, /\(Mensah et al\., 2020\)/);
  assert.doesNotMatch(result.draft, /Boateng/);
  assert.deepEqual(result.removedCitations, ['Boateng, 2018']);

  // Every optional item she left empty is a visible placeholder.
  for (const label of ['Gestation', 'Health education given']) {
    assert.match(result.draft, new RegExp(`\\[Student to supply: (Visit 1: )?${label}\\]`, 'i'));
  }
});

// Acceptance 3
test('"write the whole care study for me" gets a checklist, not a paper', async () => {
  for (const ask of ['write the whole care study for me', 'Please do everything for me', 'Can you generate a sample patient?', 'just write it for me']) {
    const { generate, calls } = fakeModel('A complete care study...');
    const result = await help(ctx(), ask, generate);
    assert.equal(result.kind, 'checklist', ask);
    assert.equal(calls.length, 0, ask);
    assert.ok(result.kind === 'checklist' && result.checklist.length > 0);
    assert.ok(result.kind === 'checklist' && result.checklist.some((s) => s.key === 'labour'));
  }
  // An ordinary question is answered as guidance.
  const tutor = fakeModel('Ask about her parents.');
  const answer = await help(ctx(), 'What goes in the family history?', tutor.generate);
  assert.equal(answer.kind, 'answer');
  assert.equal(tutor.calls.length, 1);
});

// Acceptance 4
test('phone numbers, ID numbers and digital addresses are blocked; full names are flagged', () => {
  const blocked = (t: string) => scanPrivacy(t).filter((i) => i.severity === 'block').map((i) => i.kind);
  assert.deepEqual(blocked('Her husband can be reached on 024 412 3456.'), ['phone']);
  assert.deepEqual(blocked('Call +233 20 123 4567'), ['phone']);
  assert.deepEqual(blocked('Ghana Card GHA-123456789-0'), ['id_number']);
  assert.deepEqual(blocked('NHIS No: 12345678'), ['id_number']);
  assert.deepEqual(blocked('She lives at AK-039-5028'), ['address']);
  assert.deepEqual(blocked('BP 120/80 mmHg on 28/10/21, Hb 11.8 g/dl'), []);

  const warned = scanPrivacy('Madam Pokuaa Mavis is the wife of Mr. Samuel Owusu.').filter((i) => i.severity === 'warn');
  assert.deepEqual(warned.map((w) => w.match), ['Madam Pokuaa Mavis', 'Mr. Samuel Owusu']);

  assert.match(checkPseudonym('Pokuaa Mavis')!, /full name/);
  assert.match(checkPseudonym('Madam Pokuaa Mavis')!, /full name/);
  assert.ok(checkPseudonym('0241234567'));
  assert.equal(checkPseudonym('Madam A.K.'), null);
  assert.equal(checkPseudonym('Madam Esi'), null);
});

// Acceptance 5
test("the export puts the student's own notes beside the draft", async () => {
  const entries = { fields: { where_met: 'ANC clinic, 28/10/21, 37+2 weeks', why_selected: 'Vaginal discharge earlier', period_of_care: 'Oct to Nov 2021' } };
  const buffer = await buildCareStudyDocx(
    {
      id: 'study-1', pseudonym: 'Madam A.K.', focus: 'G3P2', consent_confirmed_at: '2026-10-14T10:00:00Z',
      declaration_confirmed_at: '2026-10-14T10:00:00Z', sources,
    },
    midwifery(),
    { introduction: { entries, draft: 'INTRODUCTION\nThe client was first met at the antenatal clinic (Mensah et al., 2020).\n[Student to supply: initials]' } },
  );
  const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('string');
  assert.match(xml, /Student&apos;s own notes|Student's own notes/);
  assert.match(xml, /Polished draft/);
  assert.match(xml, /ANC clinic, 28\/10\/21, 37\+2 weeks/);
  assert.match(xml, /The client was first met at the antenatal clinic/);
  assert.match(xml, /Mensah, K\./); // bibliography from the retrieved source
  assert.match(xml, /not been approved by any college or council/);
});

test('check my work flags unrealistic values and missing nursing-process steps as questions', async () => {
  assert.equal(valueIssues('BP 80/120, temp 47 C, FHR 300, Hb 11.8 g/dl').length, 3);
  const issues = await checkWork(ctx({
    antenatal_visits: { entries: { items: [{ date: '2021-11-04', type: 'Clinic', findings: 'BP 110/70', care_given: 'x' }, { date: '2021-10-28', type: 'Home', findings: 'Temp 52 C', care_given: 'y' }] } },
  }), fakeModel('[{"section":"antenatal_visits","message":"Was a care plan made for the waist pain?"}]').generate);
  const kinds = new Set(issues.map((i) => i.kind));
  assert.ok(kinds.has('gap'));
  assert.ok(kinds.has('value'));
  assert.ok(kinds.has('nursing_process'));
  assert.ok(issues.some((i) => i.kind === 'review' && i.section === 'antenatal_visits'));
  assert.ok(issues.some((i) => /not in order/.test(i.message)));
  assert.ok(issues.filter((i) => i.kind === 'value').every((i) => /supervisor/.test(i.message)));
});

test('value guard accepts reformatted dates from the notes and leaves reference ranges alone', () => {
  const { text, flagged } = guardValues('Seen on 28 October 2021. Normal Hb is 11-16 g/dl. BP 110/70 mmHg at 8:35am.', 'Date: 2021-10-28\nBP 110/70 at 8:35');
  assert.deepEqual(flagged, []);
  assert.match(text, /28 October 2021/);
});

test('citation guard keeps listed sources and placeholders the rest', () => {
  const { text } = guardCitations('As Owusu (2019) and Mensah and Owusu (2020) note (WHO, 2016).', sources);
  assert.match(text, /Mensah and Owusu \(2020\)/);
  assert.doesNotMatch(text, /Owusu \(2019\)|WHO, 2016/);
  assert.equal(ensurePlaceholders('Text [Student to supply: gestation]', ['Visit 1: Gestation']), 'Text [Student to supply: gestation]');
});

test('front pages come first; the acknowledgement needs the student to name who to thank; the preface needs nothing', async () => {
  for (const id of ['midwifery-family-centred', 'general-nursing-patient-family']) {
    const t = getTemplate(id)!;
    assert.deepEqual(t.sections.slice(0, 3).map((s) => s.key), ['preface', 'acknowledgement', 'introduction']);
    assert.equal(t.stages[0].key, 'front');
    assert.ok(t.sections.find((s) => s.key === 'literature_review')!.word_target! >= 2500);
  }
  const ack = section('acknowledgement');
  assert.deepEqual(missingRequired(ack, undefined), ['Your supervisor', 'Staff at the facility who helped you']);

  // The preface carries no client facts, so it can be drafted straight away, and the length target reaches the prompt.
  const { generate, calls } = fakeModel('PREFACE\nA care study follows the nursing process.');
  const result = await draftSection(ctx(), section('preface'), generate);
  assert.equal(result.status, 'drafted');
  assert.match(calls[0], /LENGTH: aim for about 350 words/);
  assert.match(calls[0], /Do not claim it is required, approved or recognised/);
});

test('the literature review has its own length target and must cite from the list', async () => {
  const { generate, calls } = fakeModel('PREGNANCY\nAntenatal care matters (Mensah et al., 2020).');
  const result = await draftSection(ctx(), section('literature_review'), generate);
  assert.equal(result.status, 'drafted');
  assert.match(calls[0], /LENGTH: aim for about 3000 words/);
  assert.match(calls[0], /Every substantive statement must carry a citation from the list/);
});
