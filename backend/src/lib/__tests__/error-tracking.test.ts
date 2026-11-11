import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventFromLog, initErrorTracking, reportLog } from '../error-tracking.js';

test('a log call with fields and a message keeps the message and only the safe fields', () => {
  const event = eventFromLog(
    [{ err: 'Wallet credit failed', jobId: 'job-1', statusCode: 502, phone: '0244123456', draft: 'Chapter one text' }, 'Paper worker job failed'],
    50,
    'paper-worker',
  );
  assert.equal(event.message, 'Paper worker job failed');
  assert.equal(event.level, 'error');
  assert.equal(event.module, 'paper-worker');
  assert.deepEqual(event.extra, { err: 'Wallet credit failed', jobId: 'job-1', statusCode: 502 });
});

test('phone numbers are masked wherever they appear', () => {
  const event = eventFromLog([{ err: 'No user for +233244123456 or 0201234567' }, 'Sign-in failed for 233244123456'], 50);
  assert.equal(event.extra.err, 'No user for [phone] or [phone]');
  assert.equal(event.message, 'Sign-in failed for [phone]');
});

test('the query string is dropped from the url', () => {
  const event = eventFromLog([{ method: 'GET', url: '/api/papers/abc?token=secret&q=malaria' }, 'Unhandled error'], 50);
  assert.equal(event.extra.url, '/api/papers/abc');
  assert.equal(event.extra.method, 'GET');
});

test('a bare message, a bare Error and an Error field all produce an event', () => {
  assert.equal(eventFromLog(['Redis unreachable'], 50).message, 'Redis unreachable');

  const bare = eventFromLog([new Error('Pipeline failed')], 60);
  assert.equal(bare.message, 'Pipeline failed');
  assert.equal(bare.level, 'fatal');
  assert.equal(bare.extra.err, 'Pipeline failed');
  assert.ok(String(bare.extra.stack).includes('Pipeline failed'));

  const field = eventFromLog([{ err: new Error('Timed out') }, 'Harvest stopped'], 50);
  assert.equal(field.extra.err, 'Timed out');
  assert.equal(field.module, 'unknown');
});

test('long values are cut and a call with no message still gets one', () => {
  const event = eventFromLog([{ stack: 'x'.repeat(5000) }], 50);
  assert.equal(String(event.extra.stack).length, 2000);
  assert.equal(event.message, 'Error logged without a message');
});

test('with no SENTRY_DSN tracking stays off and reporting does nothing', async () => {
  const before = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  try {
    assert.equal(await initErrorTracking(), false);
    assert.doesNotThrow(() => reportLog([{ err: 'boom' }, 'Unhandled error'], 50, 'error'));
  } finally {
    if (before !== undefined) process.env.SENTRY_DSN = before;
  }
});
