import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySuggestion, countOccurrences, guardSuggestions, suggestionKey } from '../spans.js';

const PAPER = [
  'Mobile learning improves outcomes for all students (Mensah, 2020).',
  'The sample was 120 nurses.',
  'The results was significant.',
  'In summary, the study matters.',
  'In summary, the study matters.',
].join(' ');

const s = (over: Record<string, unknown>) => ({
  id: 's1',
  section: 'Chapter 1',
  type: 'clarity',
  severity: 'medium',
  original: 'The results was significant.',
  suggested: 'The results were significant.',
  reason: 'Subject and verb disagree.',
  ...over,
});

test('countOccurrences counts non-overlapping matches, like Postgres replace()', () => {
  assert.equal(countOccurrences('aaa', 'aa'), 1);
  assert.equal(countOccurrences(PAPER, 'In summary, the study matters.'), 2);
  assert.equal(countOccurrences(PAPER, 'missing'), 0);
  assert.equal(countOccurrences(PAPER, ''), 0);
});

test('keeps a suggestion whose original appears exactly once, verbatim', () => {
  const { kept, drops } = guardSuggestions(PAPER, [s({})], 40);
  assert.equal(kept.length, 1);
  assert.deepEqual(drops, { not_found: 0, ambiguous: 0, duplicate: 0, invalid: 0, over_cap: 0 });
});

test('drops an original that is not in the paper verbatim, even if close', () => {
  const { kept, drops } = guardSuggestions(PAPER, [
    s({ original: 'The results were significant.', suggested: 'The findings were significant.' }), // model "fixed" the text while copying
    s({ original: 'the results was significant.' }), // case differs
    s({ original: 'The results  was significant.' }), // spacing differs
  ], 40);
  assert.equal(kept.length, 0);
  assert.equal(drops.not_found, 3);
});

test('trims surrounding whitespace, which keeps the text verbatim', () => {
  const { kept } = guardSuggestions(PAPER, [s({ original: '  The results was significant. \n' })], 40);
  assert.equal(kept[0]?.original, 'The results was significant.');
});

test('drops an original that appears more than once: accepting it could change the wrong place', () => {
  const { kept, drops } = guardSuggestions(PAPER, [s({ original: 'In summary, the study matters.', suggested: 'The study matters.' })], 40);
  assert.equal(kept.length, 0);
  assert.equal(drops.ambiguous, 1);
});

test('drops malformed suggestions as invalid', () => {
  const { kept, drops } = guardSuggestions(PAPER, [
    s({ type: 'rewrite' }),
    s({ severity: 'critical' }),
    s({ suggested: 'The results was significant.' }), // no change
    s({ original: '' }),
    s({ reason: '' }),
    null,
    'text',
  ], 40);
  assert.equal(kept.length, 0);
  assert.equal(drops.invalid, 7);
});

test('two suggestions on the same passage: the higher severity one is kept', () => {
  const { kept, drops } = guardSuggestions(PAPER, [
    s({ id: 'a', severity: 'low', suggested: 'The result was significant.' }),
    s({ id: 'b', severity: 'high' }),
  ], 40);
  assert.deepEqual(kept.map((k) => k.id), ['b']);
  assert.equal(drops.duplicate, 1);
});

test('sorts by severity and caps the count, dropping the lowest first', () => {
  const raw = [
    s({ id: 'low', severity: 'low', original: 'The sample was 120 nurses.', suggested: 'The sample was 120 nurses in Kumasi.' }),
    s({ id: 'med', severity: 'medium' }),
    s({ id: 'high', severity: 'high', type: 'correction', original: 'Mobile learning improves outcomes for all students (Mensah, 2020).', suggested: 'Mobile learning can improve outcomes for students (Mensah, 2020).' }),
  ];
  const { kept, drops } = guardSuggestions(PAPER, raw, 2);
  assert.deepEqual(kept.map((k) => k.id), ['high', 'med']);
  assert.equal(drops.over_cap, 1);
});

test('applySuggestion replaces the text only while the original still matches once', () => {
  const ok = applySuggestion(PAPER, 'The results was significant.', 'The results were significant.');
  assert.equal(ok.outcome, 'accepted');
  assert.ok(ok.content.includes('The results were significant.'));
  assert.ok(!ok.content.includes('The results was significant.'));

  const stale = applySuggestion(ok.content, 'The results was significant.', 'X');
  assert.equal(stale.outcome, 'stale');
  assert.equal(stale.content, ok.content);

  const twice = applySuggestion(PAPER, 'In summary, the study matters.', 'X');
  assert.equal(twice.outcome, 'ambiguous');
  assert.equal(twice.content, PAPER);
});

test('suggestionKey is stable and depends on both texts', () => {
  const a = suggestionKey({ original: 'x', suggested: 'y' });
  assert.equal(a, suggestionKey({ original: 'x', suggested: 'y' }));
  assert.notEqual(a, suggestionKey({ original: 'x', suggested: 'z' }));
  assert.notEqual(suggestionKey({ original: 'ab', suggested: 'c' }), suggestionKey({ original: 'a', suggested: 'bc' }));
});
