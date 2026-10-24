import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlagiarism, compareToSource } from '../plagiarism-checker.service.js';
import { PLAGIARISM_SOURCES, webSource, type Passage, type PlagiarismSource, type SourceResult } from '../plagiarism-sources.js';
import { keywordQuery, pickQueries } from '../plagiarism-text.js';
import { CONFIG } from '../../../config/index.js';

// A thesis passage on the same topic the student is writing about.
const THESIS = 'Mobile money services have spread quickly across Ghana since MTN launched its platform in 2009. '
  + 'In Kumasi, small-scale traders at Kejetia and Central Market increasingly rely on mobile money for daily sales and for paying suppliers. '
  + 'This study surveyed 400 traders and found that 62 percent used mobile money every day, while transaction fees and fear of fraud were the main barriers to wider use. '
  + 'Women traders reported higher adoption than men, and the introduction of the electronic transfer levy in 2022 reduced the number of transactions for several months.';

const WIKI = 'Mobile money in Ghana grew after the Bank of Ghana issued guidelines for branchless banking in 2008. '
  + 'Interoperability between mobile money operators and banks was introduced in May 2018, allowing customers to send money between networks.';

// The student's own words on the same topic: shared vocabulary, no shared wording.
const OWN_WORDS = 'Mobile money has changed how traders in Kumasi handle payments. '
  + 'Many market women at Kejetia now accept MTN MoMo for their daily sales. '
  + 'Studies show that most traders use mobile money at least once a week.';

const COPIED = 'This study surveyed 400 traders and found that 62 percent used mobile money every day, while transaction fees and fear of fraud were the main barriers to wider use.';
const COPIED_WIKI = 'Interoperability between mobile money operators and banks was introduced in May 2018, allowing customers to send money between networks.';

const passage = (id: string, text: string): Passage => ({ title: `Work ${id}`, url: `https://example.org/${id}`, text });

/** A source that always finds the given passages, counting how often it is searched. */
function fakeSource(name: string, ...passages: Passage[]): PlagiarismSource & { calls: number } {
  const source = {
    name,
    calls: 0,
    search: async (): Promise<SourceResult> => {
      source.calls++;
      return { passages, status: 'checked' };
    },
  };
  return source;
}

test('writing on the same topic in your own words is not reported as copied', async () => {
  const report = await checkPlagiarism(OWN_WORDS, [fakeSource('Library', passage('1', THESIS)), fakeSource('Wikipedia', passage('w', WIKI))]);
  assert.equal(report.overallSimilarity, 0);
  assert.equal(report.matchCount, 0);
  assert.deepEqual(report.sources, []);
});

test('a copied sentence is found, and the total is the share of words copied', async () => {
  const text = `Mobile money has changed how traders in Kumasi handle payments. ${COPIED}`;
  const report = await checkPlagiarism(text, [fakeSource('Library', passage('1', THESIS))]);
  assert.equal(report.matchCount, 1);
  assert.equal(report.matches[0].similarity, 1);
  assert.equal(report.matches[0].originalText, COPIED.replace(/\.$/, ''));
  // 29 copied words out of 39 checked.
  assert.equal(report.overallSimilarity, 0.74);
});

test('copying is found whichever source it came from, and the match says where', async () => {
  const text = `${COPIED} ${OWN_WORDS} ${COPIED_WIKI}`;
  const report = await checkPlagiarism(text, [
    fakeSource('ResearchPadi library', { ...passage('1', THESIS), where: 'UGSpace' }),
    fakeSource('Wikipedia', passage('w', WIKI)),
  ]);
  assert.equal(report.matchCount, 2);
  assert.deepEqual(report.matches.map(m => m.source).sort(), ['Work 1 (UGSpace)', 'Work w (Wikipedia)']);
});

test('a sentence matching several sources counts once towards the total', async () => {
  const text = `Mobile money has changed how traders in Kumasi handle payments. ${COPIED}`;
  const report = await checkPlagiarism(text, [
    fakeSource('Library', passage('1', THESIS)),
    fakeSource('OpenAlex', passage('2', THESIS)),
    fakeSource('Open web', passage('3', THESIS)),
  ]);
  assert.equal(report.matchCount, 3);
  assert.equal(report.sources.length, 3);
  assert.equal(report.overallSimilarity, 0.74);
});

test('the same passage found by two sources is compared once', async () => {
  const report = await checkPlagiarism(COPIED, [fakeSource('Library', passage('1', THESIS)), fakeSource('OpenAlex', passage('1', THESIS))]);
  assert.equal(report.matchCount, 1);
});

test('the total never passes 100%', async () => {
  const report = await checkPlagiarism(`${COPIED} ${COPIED}`, [fakeSource('Library', passage('1', THESIS)), fakeSource('Web', passage('2', THESIS))]);
  assert.equal(report.overallSimilarity, 1);
});

test('each source is searched once per check, and every sentence is compared', async () => {
  const filler = Array.from({ length: 30 }, (_, i) => `Paragraph ${i + 1} describes what I saw in the market on that day`).join('. ');
  const library = fakeSource('Library', passage('1', THESIS));
  const report = await checkPlagiarism(`${filler}. ${COPIED}`, [library]);
  assert.equal(library.calls, 1);
  assert.equal(report.sentencesChecked, 31);
  assert.equal(report.matchCount, 1);
});

test('a source that cannot be searched is reported and does not stop the check', async () => {
  const broken: PlagiarismSource = { name: 'Semantic Scholar', search: async () => { throw new Error('timeout'); } };
  const busy: PlagiarismSource = { name: 'OpenAlex', search: async () => ({ passages: [], status: 'failed', note: 'busy, try again later' }) };
  const report = await checkPlagiarism(COPIED, [fakeSource('Library', passage('1', THESIS)), broken, busy]);
  assert.equal(report.matchCount, 1);
  assert.deepEqual(report.checkedSources, [
    { name: 'Library', status: 'checked', passages: 1, note: undefined },
    { name: 'Semantic Scholar', status: 'failed', passages: 0, note: 'could not be reached' },
    { name: 'OpenAlex', status: 'failed', passages: 0, note: 'busy, try again later' },
  ]);
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
  const report = await checkPlagiarism(COPIED, [fakeSource('Library', passage('1', THESIS))]);
  const shown = report.matches[0].matchedText;
  assert.match(shown, /surveyed 400 traders/);
  assert.ok(shown.length < THESIS.length);
});

test('empty text searches nothing and scores zero', async () => {
  const library = fakeSource('Library', passage('1', THESIS));
  const report = await checkPlagiarism('', [library]);
  assert.equal(library.calls, 0);
  assert.equal(report.overallSimilarity, 0);
  assert.equal(report.matchCount, 0);
  assert.deepEqual(report.checkedSources, []);
});

test('the check covers the library, Ghana repositories, scholarly databases, Wikipedia and the web', () => {
  assert.deepEqual(PLAGIARISM_SOURCES.map(s => s.name), [
    'ResearchPadi library',
    'Ghana university repositories',
    'OpenAlex',
    'Semantic Scholar',
    'Wikipedia',
    'Open web',
  ]);
});

test('web search is skipped, not failed, when no Perplexity key is set', async () => {
  const saved = CONFIG.PERPLEXITY_API_KEY;
  (CONFIG as { PERPLEXITY_API_KEY?: string }).PERPLEXITY_API_KEY = '';
  try {
    const result = await webSource.search([COPIED]);
    assert.deepEqual(result, { passages: [], status: 'skipped', note: 'not set up' });
  } finally {
    (CONFIG as { PERPLEXITY_API_KEY?: string }).PERPLEXITY_API_KEY = saved;
  }
});

test('search queries use the most distinctive sentences and their meaningful words', () => {
  const sentences = ['It was a good day for all of us', COPIED, 'We went home after that and we slept'];
  assert.deepEqual(pickQueries(sentences, 1), [COPIED]);
  assert.equal(keywordQuery(COPIED, 6), 'surveyed traders percent mobile transaction barriers');
  // Hyphenated words are searched as separate words.
  assert.equal(keywordQuery('M-PESA is a phone-based money transfer service', 4), 'phone based transfer service');
});
