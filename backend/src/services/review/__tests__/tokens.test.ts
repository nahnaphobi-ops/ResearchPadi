import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PaperSource } from '../../pipeline/paper-source.js';
import { formatSources } from '../prompts.js';
import { planReaderInput, rankSources, splitByParagraphs, TRIMMED_ABSTRACT_CHARS, type CountTokens } from '../tokens.js';

// About 4 characters per token, plus a fixed overhead for the instructions.
const fakeCount: CountTokens = async (part, sources) => Math.ceil((part.length + formatSources(sources).length) / 4) + 200;

const source = (surname: string, year: number, abstractChars = 200): PaperSource => ({
  title: `A study by ${surname}`,
  authors: `${surname}, Kofi`,
  author_surname: surname,
  year,
  abstract: 'x'.repeat(abstractChars),
});

const paragraph = (words: number, cite = '') => `${Array.from({ length: words }, (_, i) => `word${i}`).join(' ')} ${cite}`.trim() + '.';

function paper(chapterWords: number): string {
  return [
    'ABSTRACT',
    paragraph(80),
    'CHAPTER 1: Introduction',
    paragraph(chapterWords, '(Mensah, 2020)'),
    paragraph(chapterWords, '(Mensah, 2020)'),
    'CHAPTER 2: Literature Review',
    paragraph(chapterWords, '(Owusu, 2019)'),
    paragraph(chapterWords),
    'References',
    'Mensah, K. (2020). A study by Mensah.',
  ].join('\n\n');
}

test('rankSources: cited sources first, most-mentioned first, keys in that order', () => {
  const text = 'One (Owusu, 2019). Two (Mensah, 2020). Three (Mensah, 2020).';
  const ranked = rankSources(text, [source('Boateng', 2018), source('Owusu', 2019), source('Mensah', 2020)]);
  assert.deepEqual(ranked.map((r) => [r.key, r.source.author_surname, r.cited]), [
    ['S1', 'Mensah', true],
    ['S2', 'Owusu', true],
    ['S3', 'Boateng', false],
  ]);
});

test('under the budget: one call with the whole paper and every source', async () => {
  const text = paper(100);
  const ranked = rankSources(text, [source('Mensah', 2020), source('Owusu', 2019), source('Boateng', 2018)]);
  const plan = await planReaderInput(text, ranked, 10_000, fakeCount);
  assert.equal(plan.strategy, 'full');
  assert.equal(plan.chunks.length, 1);
  assert.equal(plan.chunks[0].text, text);
  assert.equal(plan.chunks[0].sources.length, 3);
});

test('too many sources: keep only the cited ones, whole paper in one call', async () => {
  const text = paper(100);
  const uncited = Array.from({ length: 40 }, (_, i) => source(`Uncited${i}`, 2000 + i, 2_000));
  const ranked = rankSources(text, [source('Mensah', 2020), source('Owusu', 2019), ...uncited]);
  const plan = await planReaderInput(text, ranked, 5_000, fakeCount);
  assert.equal(plan.strategy, 'top_sources');
  assert.equal(plan.chunks.length, 1);
  assert.equal(plan.chunks[0].text, text);
  assert.deepEqual(plan.chunks[0].sources.map((s) => s.source.author_surname).sort(), ['Mensah', 'Owusu']);
  assert.ok(plan.chunks[0].promptTokens <= 5_000);
});

test('cited sources too long: their abstracts are trimmed before the paper is split', async () => {
  const text = paper(100);
  const ranked = rankSources(text, [source('Mensah', 2020, 12_000), source('Owusu', 2019, 12_000)]);
  const plan = await planReaderInput(text, ranked, 2_500, fakeCount);
  assert.equal(plan.strategy, 'top_sources');
  for (const s of plan.chunks[0].sources) assert.ok(s.abstract.length <= TRIMMED_ABSTRACT_CHARS + 3);
});

test('paper too long: split by chapter, every part under the budget, no text lost', async () => {
  const text = paper(3_000);
  const ranked = rankSources(text, [source('Mensah', 2020), source('Owusu', 2019)]);
  const budget = 12_000;
  const plan = await planReaderInput(text, ranked, budget, fakeCount);
  assert.equal(plan.strategy, 'by_section');
  assert.ok(plan.chunks.length >= 2);
  for (const c of plan.chunks) assert.ok(c.promptTokens <= budget, `${c.label} has ${c.promptTokens} tokens`);
  assert.deepEqual(plan.chunks.map((c) => c.part), plan.chunks.map((_, i) => i + 1));
  assert.ok(plan.chunks.every((c) => c.parts === plan.chunks.length));

  const joined = plan.chunks.map((c) => c.text).join('\n\n');
  for (const p of text.split('\n\n')) assert.ok(joined.includes(p), `lost: ${p.slice(0, 40)}`);

  // Each chapter part carries the sources it cites, not the whole list.
  const ch2 = plan.chunks.find((c) => c.label.startsWith('Chapter 2'));
  assert.deepEqual(ch2?.sources.map((s) => s.source.author_surname), ['Owusu']);
});

test('one paragraph bigger than the budget is still split until each part fits', async () => {
  const text = paragraph(20_000);
  const plan = await planReaderInput(text, [], 8_000, fakeCount);
  assert.equal(plan.strategy, 'by_section');
  for (const c of plan.chunks) assert.ok(c.promptTokens <= 8_000);
  assert.equal(plan.chunks.map((c) => c.text).join(''), text);
});

test('splitByParagraphs joins back to the exact text', () => {
  const text = 'a a a\n\nb b\n\n\nc c c c\n\nd';
  const parts = splitByParagraphs(text, 2);
  assert.equal(parts.length, 2);
  assert.equal(parts.join(''), text);
});
