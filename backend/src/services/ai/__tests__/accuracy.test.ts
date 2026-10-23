import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCURACY_RULE, withAccuracyRule } from '../accuracy.js';
import { ORIGINALITY_RULE } from '../originality.js';
import { systemPromptFor } from '../gateway.service.js';
import { WORKSPACE_SYSTEM_PROMPT } from '../workspace-assist.service.js';
import { INLINE_SYSTEM_PROMPT } from '../inline-ai.service.js';
import { buildSupervisionSystemPrompt } from '../prompts.js';
import { COACH_SYSTEM_PROMPT } from '../../workspace/study-draft.service.js';
import { NOTEBOOK_SYSTEM_PROMPT } from '../../notebook/notebook-ai.js';
import { CARE_STUDY_RULES, CARE_STUDY_SYSTEM_PROMPT as GUIDED_CARE_STUDY_PROMPT } from '../../care-study/prompts.js';
import { CARE_STUDY_SYSTEM_PROMPT as MODEL_CARE_STUDY_PROMPT } from '../../pipeline/care-study.service.js';

test('the rule covers every accuracy requirement', () => {
  // The person is treated as at least as capable as the model.
  assert.match(ACCURACY_RULE, /capable adult who may know more than you/);
  assert.match(ACCURACY_RULE, /as an equal: no talking down, over-explaining, flattery or padding/);
  assert.match(ACCURACY_RULE, /is the authority on their own work/);
  assert.match(ACCURACY_RULE, /leave the decision to them\. Never quietly change their facts/);
  // No guessing, and uncertainty is said out loud.
  assert.match(ACCURACY_RULE, /Never guess/);
  assert.match(ACCURACY_RULE, /Never fill a gap with something that merely sounds right/);
  assert.match(ACCURACY_RULE, /When you are not sure, say so plainly or leave the point out/);
  assert.match(ACCURACY_RULE, /Never present an opinion, estimate or likely answer as established fact/);
  assert.match(ACCURACY_RULE, /never claim to have checked, read or done something you have not/);
  assert.match(ACCURACY_RULE, /say in one short line what you assumed/);
  // It must never break a feature's fixed answer form, placeholders or labelled illustrations.
  assert.match(ACCURACY_RULE, /Where another instruction is stricter, or says how to show something missing, follow it/);
  assert.match(ACCURACY_RULE, /stay inside it: leave an unknown item out or empty, or use the placeholder your instructions give/);
  assert.match(ACCURACY_RULE, /Keep it labelled exactly as your instructions say/);
});

test('the rule is added after a system prompt, once, leaving the prompt intact', () => {
  assert.equal(withAccuracyRule(), ACCURACY_RULE);
  assert.equal(withAccuracyRule('  '), ACCURACY_RULE);
  const once = withAccuracyRule('You are a tutor.');
  assert.ok(once.startsWith('You are a tutor.\n\n'));
  assert.ok(once.endsWith(ACCURACY_RULE));
  assert.equal(withAccuracyRule(once), once);
});

// Every system prompt a feature sends, with a rule of its own that must survive.
const FEATURES: [feature: string, systemPrompt: string | undefined, ownRule: RegExp | null][] = [
  ['guided care study draft', GUIDED_CARE_STUDY_PROMPT, /\[Student to supply: <what is missing>\]/],
  ['guided care study help and review', CARE_STUDY_RULES, /Never fill a gap with a typical, normal or likely value/],
  ['model care study chapters, review and fixes', MODEL_CARE_STUDY_PROMPT, /Use only the facts in the CASE RECORD/],
  ['writing assist', WORKSPACE_SYSTEM_PROMPT, /Maintain the researcher's voice/],
  ['editor AI', INLINE_SYSTEM_PROMPT, /Never\s+invent new citations or references/],
  ['coach', COACH_SYSTEM_PROMPT, /Never write sentences or paragraphs the student could paste/],
  ['notebook', NOTEBOOK_SYSTEM_PROMPT, /Use only information that is in the excerpts/],
  ['paper supervision', buildSupervisionSystemPrompt('Malaria in Ghana', 'Nursing', 'university', 8000, []), /only these may be cited/],
  ['paper chapters and other single-prompt calls', undefined, null],
];

for (const [feature, own, ownRule] of FEATURES) {
  test(`${feature}: the model gets the accuracy rule last and keeps its own rules`, () => {
    const sent = systemPromptFor({ systemPrompt: own });
    assert.ok(sent.endsWith(ACCURACY_RULE), `${feature} is sent without the accuracy rule`);
    assert.ok(sent.indexOf(ORIGINALITY_RULE) < sent.indexOf(ACCURACY_RULE), `${feature} lost the originality rule`);
    if (own && ownRule) {
      assert.ok(sent.startsWith(own.trim()), `${feature}'s own system prompt was changed`);
      assert.match(sent, ownRule);
    }
  });
}

test('verbatim parsing calls skip only the originality rule, never the accuracy rule', () => {
  assert.equal(systemPromptFor({ systemPrompt: 'Parse.', originality: false }), `Parse.\n\n${ACCURACY_RULE}`);
  assert.equal(systemPromptFor({ originality: false }), ACCURACY_RULE);
});
