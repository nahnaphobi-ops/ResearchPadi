import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlagiarism, compareToSource } from '../plagiarism-checker.service.js';
import type { KnowledgeHit } from '../../rag/retriever.service.js';

// A thesis passage on the same topic the student is writing about.
const THESIS = 'Mobile money services have spread quickly across Ghana since MTN launched its platform in 2009. '
  + 'In Kumasi, small-scale traders at Kejetia and Central Market increasingly rely on mobile money for daily sales and for paying suppliers. '
  + 'This study surveyed 400 traders and found that 62 percent used mobile money every day, while transaction fees and fear of fraud were the main barriers to wider use. '
  + 'Women traders reported higher adoption than men, and the introduction of the electronic transfer levy in 2022 reduced the number of transactions for several months.';

// The student's own words on the same topic: shared vocabulary, no shared wording.
const OWN_WORDS = 'Mobile money has changed how traders in Kumasi handle payments. '
  + 'Many market women at Kejetia now accept MTN MoMo for their daily sales. '
  + 'Studies show that most traders use mobile money at least once a week.';

const COPIED = 'This study surveyed 400 traders and found that 62 percent used mobile money every day, while transaction fees and fear of fraud were the main barriers to wider use.';

function hit(id: string, chunkText: string): KnowledgeHit {
  return {
    id,
    document_title: `Thesis ${id}`,
    chunk_text: chunkText,
    authors: null,
    year: null,
    institution: null,
    source_name: 'UGSpace',
    source_url: `https://ugspace.ug.edu.gh/handle/${id}`,
    field: null,
    doi: null,
    journal: null,
    publisher: null,
    document_type: null,
    keyword_rank: null,
    vector_similarity: null,
    score: 1,
  };
}

const searchReturning = (...hits: KnowledgeHit[]) => async () => hits;

test('writing on the same topic in your own words is not reported as copied', async () => {
  const report = await checkPlagiarism(OWN_WORDS, searchReturning(hit('1', THESIS)));
  assert.equal(report.overallSimilarity, 0);
  assert.equal(report.matchCount, 0);
  assert.deepEqual(report.sources, []);
});

test('a copied sentence is found, and the total is the share of words copied', async () => {
  const text = `Mobile money has changed how traders in Kumasi handle payments. ${COPIED}`;
  const report = await checkPlagiarism(text, searchReturning(hit('1', THESIS)));
  assert.equal(report.matchCount, 1);
  assert.equal(report.matches[0].similarity, 1);
  assert.equal(report.matches[0].originalText, COPIED.replace(/\.$/, ''));
  // 29 copied words out of 39 checked.
  assert.equal(report.overallSimilarity, 0.74);
});

test('a sentence matching several sources counts once towards the total', async () => {
  const text = `Mobile money has changed how traders in Kumasi handle payments. ${COPIED}`;
  const report = await checkPlagiarism(text, searchReturning(hit('1', THESIS), hit('2', THESIS), hit('3', THESIS)));
  assert.equal(report.matchCount, 3);
  assert.equal(report.sources.length, 3);
  assert.equal(report.overallSimilarity, 0.74);
});

test('the total never passes 100%', async () => {
  const report = await checkPlagiarism(`${COPIED} ${COPIED}`, searchReturning(hit('1', THESIS), hit('2', THESIS)));
  assert.equal(report.overallSimilarity, 1);
});

test('light rewording of a copied sentence is still caught', () => {
  const reworded = 'The survey of 400 traders found that 62 per cent used mobile money each day; transaction fees and the fear of fraud were the main barriers to wider use';
  const { similarity } = compareToSource(reworded, THESIS);
  assert.ok(similarity > 0.5, `similarity ${similarity}`);
});

test('sharing topic words alone scores nothing', () => {
  for (const sentence of OWN_WORDS.split('. ')) {
    assert.equal(compareToSource(sentence, THESIS).similarity, 0, sentence);
  }
});

test('the match shows the source passage around the shared words, not the whole chunk', async () => {
  const report = await checkPlagiarism(COPIED, searchReturning(hit('1', THESIS)));
  const shown = report.matches[0].matchedText;
  assert.match(shown, /surveyed 400 traders/);
  assert.ok(shown.length < THESIS.length);
});

test('empty text is not searched and scores zero', async () => {
  let searched = false;
  const report = await checkPlagiarism('', async () => {
    searched = true;
    return [];
  });
  assert.equal(searched, false);
  assert.equal(report.overallSimilarity, 0);
  assert.equal(report.matchCount, 0);
});
