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

test('feedback and explain need a selection and are advice-only', async () => {
  const { ADVICE_ACTIONS } = await import('../inline-ai.service.js');
  assert.ok('error' in buildInlinePrompt({ action: 'feedback' }));
  const fb = buildInlinePrompt({ action: 'feedback', text: 'Mobile money is used by traders.' });
  assert.ok(!('error' in fb) && fb.tier === 'drafting' && /Do not rewrite/.test(fb.prompt));
  const ex = buildInlinePrompt({ action: 'explain', text: 'Burstiness' });
  assert.ok(!('error' in ex) && ex.tier === 'light');
  assert.ok(ADVICE_ACTIONS.has('feedback') && ADVICE_ACTIONS.has('explain') && !ADVICE_ACTIONS.has('improve'));
});

test('the document outline is passed as context', () => {
  const built = buildInlinePrompt({ action: 'continue', outline: 'CHAPTER 1: INTRODUCTION\n1.1 Background' });
  assert.ok(!('error' in built) && built.prompt.includes('DOCUMENT OUTLINE') && built.prompt.includes('1.1 Background'));
});
