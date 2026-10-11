import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUBRIC, countWords, priceFor } from '../review.service.js';

test('review prices: a whole document costs more than a selected part', () => {
  assert.ok(priceFor('full') > priceFor('excerpt'));
  assert.ok(priceFor('excerpt') > 0);
});

test('countWords ignores markup and non-breaking spaces', () => {
  assert.equal(countWords('<h1>Chapter One</h1><p>Mobile&nbsp;learning <strong>helps</strong> students.</p>'), 6);
  assert.equal(countWords(''), 0);
});

test('the checklist has unique keys', () => {
  assert.equal(new Set(RUBRIC.map((r) => r.key)).size, RUBRIC.length);
});
