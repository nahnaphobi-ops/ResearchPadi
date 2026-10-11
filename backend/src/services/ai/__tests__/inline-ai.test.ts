import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInlinePrompt, isInlineAction } from '../inline-ai.service.js';

test('selection edits use the light tier and include the selection', () => {
  const r = buildInlinePrompt({ action: 'shorten', text: 'A long sentence about mobile learning.', before: 'Intro.' });
  assert.ok(!('error' in r));
  assert.equal(r.tier, 'light');
  assert.match(r.prompt, /SELECTED TEXT:\nA long sentence/);
  assert.match(r.prompt, /TEXT BEFORE THE SELECTION/);
});

test('writing new material uses the drafting tier', () => {
  const r = buildInlinePrompt({ action: 'continue', before: 'Chapter one text.' });
  assert.ok(!('error' in r) && r.tier === 'drafting');
});

test('missing selection or request is rejected', () => {
  assert.deepEqual(buildInlinePrompt({ action: 'improve' }), { error: 'Select some text first.' });
  assert.deepEqual(buildInlinePrompt({ action: 'draft' }), { error: 'Tell the AI what you want.' });
  assert.deepEqual(buildInlinePrompt({ action: 'refine', prompt: 'shorter' }), { error: 'Nothing to refine yet.' });
});

test('long context is clipped from the far end', () => {
  const before = 'x'.repeat(10_000) + 'END';
  const r = buildInlinePrompt({ action: 'continue', before });
  assert.ok(!('error' in r));
  assert.ok(r.prompt.includes('END'));
  assert.ok(r.prompt.length < 6_000);
});

test('only known actions are accepted', () => {
  assert.equal(isInlineAction('improve'), true);
  assert.equal(isInlineAction('delete-everything'), false);
  assert.equal(isInlineAction(undefined), false);
});
