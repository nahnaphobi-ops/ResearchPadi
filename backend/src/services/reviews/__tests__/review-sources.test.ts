import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTemplate } from '../../care-study/template.service.js';
import {
  CARE_STUDY_RUBRIC, RUBRIC, careStudyParts, careStudySnapshot, cleanSpecialties, paperChapters, paperParts, reviewerCanTake, rubricFor, textToHtml,
} from '../review-sources.js';
import { validateApplication } from '../application.service.js';

const midwifery = getTemplate('midwifery-family-centred')!;

test('requests with a specialty only go to reviewers vetted for it', () => {
  assert.equal(reviewerCanTake(['midwifery'], 'midwifery'), true);
  assert.equal(reviewerCanTake(['general_nursing'], 'midwifery'), false);
  assert.equal(reviewerCanTake([], 'midwifery'), false);
  assert.equal(reviewerCanTake(null, 'midwifery'), false);
  // Requests with no specialty (workspace documents and papers) are open to every reviewer.
  assert.equal(reviewerCanTake([], null), true);
  assert.equal(reviewerCanTake(['midwifery'], undefined), true);
});

test('specialties are limited to the known list and de-duplicated', () => {
  assert.deepEqual(cleanSpecialties(['midwifery', 'midwifery', 'astrology', 5]), ['midwifery']);
  assert.deepEqual(cleanSpecialties('midwifery'), []);
});

test('care studies are scored on their own checklist; everything else keeps the original', () => {
  assert.equal(rubricFor('care_study'), CARE_STUDY_RUBRIC);
  assert.equal(rubricFor('paper'), RUBRIC);
  assert.equal(rubricFor('workspace'), RUBRIC);
  assert.equal(rubricFor(undefined), RUBRIC);
});

test('textToHtml escapes markup, makes headings, and keeps tables as tables', () => {
  const html = textToHtml([
    'CHAPTER 2: LITERATURE REVIEW',
    '2.1 Concepts',
    'A paragraph with <script>alert(1)</script> & more.',
    '| DATE | EVALUATION |',
    '| --- | --- |',
    '| 28/10/21 | Goal fully met |',
  ].join('\n'));
  assert.match(html, /<h2>CHAPTER 2: LITERATURE REVIEW<\/h2>/);
  assert.match(html, /<h3>2\.1 Concepts<\/h3>/);
  assert.match(html, /<p>A paragraph with &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; more\.<\/p>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<th>DATE<\/th><th>EVALUATION<\/th>/);
  assert.match(html, /<td>28\/10\/21<\/td><td>Goal fully met<\/td>/);
  assert.doesNotMatch(html, /---/);
});

test('a generated paper can be reviewed whole or by chapter', () => {
  const paper = [
    'Abstract text.',
    'CHAPTER 1: INTRODUCTION', '1.1 Background', 'Intro text.',
    'CHAPTER 2: LITERATURE REVIEW', 'Review text.',
    'References', 'Mensah, K. (2021). A title.',
  ].join('\n');
  const chapters = paperChapters(paper);
  assert.deepEqual(chapters.map((c) => [c.key, c.label]), [['1', 'Chapter 1: INTRODUCTION'], ['2', 'Chapter 2: LITERATURE REVIEW']]);
  assert.ok(chapters[1].text.endsWith('Review text.'));
  assert.deepEqual(paperParts(paper).map((p) => p.key), ['1', '2']);
});

test("a care study snapshot puts the student's notes next to the draft, and only includes sections with content", () => {
  const sections = {
    introduction: {
      entries: { fields: { where_met: 'ANC clinic, 28/10/21', why_selected: 'Vaginal discharge', period_of_care: 'Oct to Nov 2021' } },
      draft: 'INTRODUCTION\nThe client was met at the antenatal clinic.',
    },
    labour: { entries: { fields: { admission: 'Admitted 09/11/21 at 06:00' } } },
  };
  assert.deepEqual(careStudyParts(midwifery, sections).map((p) => p.key), ['introduction', 'labour']);

  const html = careStudySnapshot(midwifery, { pseudonym: 'Madam A.K.', focus: 'G3P2' }, sections);
  assert.match(html, /Madam A\.K\./);
  assert.match(html, /<h2>Introduction<\/h2><h3>Student's own notes<\/h3>/);
  assert.match(html, /<strong>Where and when you first met her:<\/strong> ANC clinic, 28\/10\/21/);
  assert.match(html, /<h3>Draft<\/h3>.*The client was met at the antenatal clinic\./);
  assert.match(html, /Not drafted yet/); // labour has notes but no draft
  assert.doesNotMatch(html, /Antenatal visits and home visits/);

  const one = careStudySnapshot(midwifery, { pseudonym: 'Madam A.K.' }, sections, 'labour');
  assert.match(one, /Labour and delivery/);
  assert.doesNotMatch(one, /<h2>Introduction<\/h2>/);
});

test('reviewer applications need real details, a known specialty and the declaration', () => {
  const good = {
    display_name: 'Dr. A. Mensah', institution: 'Holy Family NMTC', qualification: 'MPhil Midwifery',
    specialties: ['midwifery', 'astrology'], years_experience: 8, bio: '  Tutor   in midwifery ', profile_url: 'https://example.com/me', declaration: true,
  };
  const ok = validateApplication(good);
  assert.ok(ok.ok);
  assert.deepEqual(ok.value.specialties, ['midwifery']);
  assert.equal(ok.value.bio, 'Tutor in midwifery');

  for (const [change, message] of [
    [{ display_name: '' }, /name students/],
    [{ institution: '' }, /institution/],
    [{ qualification: '' }, /qualification/],
    [{ specialties: ['astrology'] }, /at least one area/],
    [{ years_experience: -1 }, /years of experience/],
    [{ years_experience: 'many' }, /years of experience/],
    [{ profile_url: 'javascript:alert(1)' }, /https/],
    [{ declaration: false }, /Confirm/],
  ] as const) {
    const result = validateApplication({ ...good, ...change });
    assert.ok(!result.ok, JSON.stringify(change));
    assert.match(result.error, message);
  }
});

test('review prices are GHS 75 for a part and GHS 100 for the whole, and the reviewer share is unchanged', async () => {
  const { priceFor } = await import('../review.service.js');
  const { CONFIG } = await import('../../../config/index.js');
  if (!process.env.REVIEW_PRICE_EXCERPT_GHS && !process.env.REVIEW_PRICE_FULL_GHS) {
    assert.equal(priceFor('excerpt'), 75);
    assert.equal(priceFor('full'), 100);
  }
  assert.ok(priceFor('excerpt') < priceFor('full'));
  assert.equal(CONFIG.PRICING.REVIEW.REVIEWER_SHARE, 0.65);
});
