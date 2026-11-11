import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReaderNotes, parseSuggestions, ReviewOutputError, salvageArrayItems } from '../schema.js';
import { isRetryable, retryDelayMs, withRetry } from '../retry.js';

test('salvage keeps the complete suggestions from a response cut off at max_tokens', () => {
  const cut = '{"suggestions":[{"id":"s1","original":"a {brace} and \\"quote\\"","suggested":"b"},{"id":"s2","original":"c","sugg';
  const items = salvageArrayItems(cut, 'suggestions') as { id: string; original: string }[];
  assert.equal(items.length, 1);
  assert.equal(items[0].original, 'a {brace} and "quote"');
});

test('parseSuggestions: valid JSON parses whole; broken JSON is an error unless the response was cut off', () => {
  assert.deepEqual(parseSuggestions('{"suggestions":[{"id":"s1"}]}', false), { items: [{ id: 's1' }], salvaged: false });
  assert.throws(() => parseSuggestions('{"suggestions":[{"id"', false), ReviewOutputError);
  assert.deepEqual(parseSuggestions('{"suggestions":[{"id":"s1"},{"id"', true), { items: [{ id: 's1' }], salvaged: true });
});

test('parseReaderNotes drops entries without a sentence and rejects non-JSON', () => {
  const notes = parseReaderNotes(JSON.stringify({
    summary: [{ section: 'Chapter 1', summary: 'Introduces the topic.' }],
    unsupported_claims: [{ section: 'Chapter 1', sentence: 'X is true.', source_key: '', issue: 'no_citation', detail: '' }, { section: 'Chapter 1', sentence: '' }],
    citation_problems: [],
    issues: [],
  }));
  assert.equal(notes.unsupported_claims.length, 1);
  assert.throws(() => parseReaderNotes('not json'), ReviewOutputError);
});

test('retries 429 and overloaded errors, not bad requests', () => {
  assert.equal(isRetryable({ status: 429 }), true);
  assert.equal(isRetryable({ status: 529 }), true);
  assert.equal(isRetryable({ status: 400, error: { error: { type: 'overloaded_error' } } }), true);
  assert.equal(isRetryable({ status: 400 }), false);
  assert.equal(isRetryable({ status: 401 }), false);
});

test('retries connection errors and timeouts from the SDK, found by class name', () => {
  class APIError extends Error {}
  class APIConnectionError extends APIError {}
  class APIConnectionTimeoutError extends APIConnectionError {}
  assert.equal(isRetryable(new APIConnectionError('Connection error.')), true);
  assert.equal(isRetryable(new APIConnectionTimeoutError('Request timed out.')), true);
  assert.equal(isRetryable(new APIError('Bad request')), false);
  assert.equal(isRetryable(null), false);
});

test('backoff uses retry-after when the API sends it, else grows exponentially', () => {
  assert.equal(retryDelayMs({ headers: { 'retry-after': '7' } }, 1), 7000);
  assert.equal(retryDelayMs({}, 1, 1000, 60_000, () => 0.5), 1000);
  assert.equal(retryDelayMs({}, 3, 1000, 60_000, () => 0.5), 4000);
  assert.equal(retryDelayMs({}, 10, 1000, 60_000, () => 0.5), 60_000);
});

test('withRetry retries until success, then stops at the attempt limit', async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const ok = await withRetry(async () => {
    calls++;
    if (calls < 3) throw { status: 529 };
    return 'done';
  }, { attempts: 4, baseDelayMs: 10, sleep: async (ms) => { sleeps.push(ms); } });
  assert.equal(ok, 'done');
  assert.equal(calls, 3);
  assert.equal(sleeps.length, 2);

  calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw { status: 429 }; }, { attempts: 3, sleep: async () => {} }));
  assert.equal(calls, 3);

  calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw { status: 400 }; }, { attempts: 3, sleep: async () => {} }));
  assert.equal(calls, 1);
});
