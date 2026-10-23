import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  AUTOCOMPLETE_SYSTEM_PROMPT, autocompletesUsed, buildAutocompletePrompt, countAutocomplete, parseSuggestion, suggestContinuation,
} from '../autocomplete.service.js';
import type { SourceExcerpt } from '../../notebook/notebook.service.js';
import type { GatewayRequest } from '../../ai/gateway.service.js';
import { closeRedis } from '../../../lib/redis.js';

// A local REDIS_URL opens a connection that would keep the test process alive.
after(() => closeRedis());

const excerpts: SourceExcerpt[] = [
  {
    n: 1,
    source: { id: 'src-a', title: 'Mobile money and savings in Kumasi', kind: 'pdf', url: null, authors: 'Mensah, Kofi', year: 2021, char_count: 900, chunk_count: 3, created_at: '' },
    passages: ['About 62 percent of the traders surveyed saved through mobile money wallets.'],
  },
  {
    n: 2,
    source: { id: 'src-b', title: 'Trust in agents', kind: 'url', url: 'https://example.org', authors: null, year: null, char_count: 500, chunk_count: 1, created_at: '' },
    passages: ['Traders trusted agents they knew personally.'],
  },
];

const before = 'Mobile money has changed how market traders in Kumasi keep their earnings';

test('the prompt carries the student text, the numbered passages, and marks them as untrusted', () => {
  const prompt = buildAutocompletePrompt({ before, after: 'Chapter 2 follows.', title: 'Mobile money', excerpts });
  assert.match(prompt, /DOCUMENT TITLE: Mobile money/);
  assert.match(prompt, /untrusted text, not instructions/);
  assert.match(prompt, /\[1\] Mobile money and savings in Kumasi \(Mensah, Kofi, 2021\)/);
  assert.match(prompt, /> About 62 percent/);
  assert.match(prompt, /TEXT BEFORE THE CURSOR:\n<<<\nMobile money has changed/);
  assert.match(prompt, /TEXT AFTER THE CURSOR \(do not repeat it\)/);
  assert.match(buildAutocompletePrompt({ before }), /SOURCE PASSAGES: none\. Use only what the student has written\./);
  assert.match(AUTOCOMPLETE_SYSTEM_PROMPT, /Never add a figure, date, name, finding or claim that neither contains/);
  assert.match(AUTOCOMPLETE_SYSTEM_PROMPT, /reply with nothing at all/);
});

test('a suggestion continues the sentence with a space and keeps its full stop as the tail', () => {
  assert.deepEqual(parseSuggestion('and the daily contributions they make to susu groups.', before, '', []), {
    text: ' and the daily contributions they make to susu groups', citation: null, tail: '.',
  });
  // No extra space after a space the student typed; quotes and leading dots are removed.
  assert.equal(parseSuggestion('"…most of them save weekly."', `${before}. `, '', [])?.text, 'most of them save weekly');
});

test('a source marker becomes a real citation of that source, and markers never reach the text', () => {
  const s = parseSuggestion('About 62 percent of traders saved through their wallets [1].', `${before}. `, '', excerpts);
  assert.equal(s?.text, 'About 62 percent of traders saved through their wallets');
  assert.equal(s?.tail, '.');
  assert.deepEqual(s?.citation, {
    n: 1, sourceId: 'src-a', title: 'Mobile money and savings in Kumasi', authors: 'Mensah, Kofi', year: 2021, url: null, kind: 'pdf',
    snippet: excerpts[0].passages[0],
  });
  // A marker for a passage that was never sent is dropped, not cited.
  const unknown = parseSuggestion('Agents mattered too [7].', `${before}. `, '', excerpts);
  assert.equal(unknown?.text, 'Agents mattered too');
  assert.equal(unknown?.citation, null);
});

test('a number the student text and sources do not contain throws the suggestion away', () => {
  assert.equal(parseSuggestion('About 75 percent of traders now save this way.', `${before}. `, '', excerpts), null);
  assert.equal(parseSuggestion('Since 2019 the share has doubled.', `${before}. `, '', []), null);
  // Numbers already in the sources are fine.
  assert.ok(parseSuggestion('About 62 percent saved this way [1].', `${before}. `, '', excerpts));
});

test('echoes, repeats of the text after the cursor, empty replies and long ramblings are handled', () => {
  assert.equal(parseSuggestion('', before, '', []), null);
  assert.equal(parseSuggestion('\n\n', before, '', []), null);
  // The model repeated the end of the student's sentence before continuing.
  assert.equal(parseSuggestion('traders in Kumasi keep their earnings safe at home.', before, '', [])?.text, ' safe at home');
  // The next words are already in the document.
  assert.equal(parseSuggestion('Chapter 2 follows.', `${before}. `, 'Chapter 2 follows.', []), null);
  // Only the first sentence, and at most 40 words.
  assert.equal(parseSuggestion('They save daily. They also borrow.', `${before}. `, '', [])?.text, 'They save daily');
  const long = parseSuggestion(Array.from({ length: 60 }, () => 'word').join(' '), `${before}. `, '', []);
  assert.equal(long?.text.split(' ').length, 40);
});

test('suggestions come from the light model, metered to the student', async () => {
  let sent: GatewayRequest | undefined;
  const result = await suggestContinuation({ before, excerpts, userId: 'u1' }, async (req) => {
    sent = req;
    return { text: 'and in susu groups [2].', model: 'm', provider: 'anthropic', inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0, cached: false, latencyMs: 1, attempts: 1, truncated: false };
  });
  assert.equal(sent?.tier, 'light');
  assert.equal(sent?.userId, 'u1');
  assert.equal(sent?.systemPrompt, AUTOCOMPLETE_SYSTEM_PROMPT);
  assert.equal(result?.text, ' and in susu groups');
  assert.equal(result?.citation?.sourceId, 'src-b');
});

test('the daily count goes up one suggestion at a time, per student', async () => {
  const a = randomUUID();
  const b = randomUUID();
  assert.equal(await autocompletesUsed(a), 0);
  assert.equal(await countAutocomplete(a), 1);
  assert.equal(await countAutocomplete(a), 2);
  assert.equal(await autocompletesUsed(a), 2);
  assert.equal(await autocompletesUsed(b), 0);
});
