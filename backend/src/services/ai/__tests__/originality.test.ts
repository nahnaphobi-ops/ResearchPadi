import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGINALITY_RULE, withOriginalityRule } from '../originality.js';
import { systemPromptFor } from '../gateway.service.js';
import { WORKSPACE_SYSTEM_PROMPT } from '../workspace-assist.service.js';
import { INLINE_SYSTEM_PROMPT } from '../inline-ai.service.js';
import { buildSupervisionSystemPrompt } from '../prompts.js';
import { COACH_SYSTEM_PROMPT } from '../../workspace/study-draft.service.js';
import { NOTEBOOK_SYSTEM_PROMPT } from '../../notebook/notebook-ai.js';
import { CARE_STUDY_RULES, CARE_STUDY_SYSTEM_PROMPT as GUIDED_CARE_STUDY_PROMPT } from '../../care-study/prompts.js';
import { CARE_STUDY_SYSTEM_PROMPT as MODEL_CARE_STUDY_PROMPT } from '../../pipeline/care-study.service.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('the rule covers every originality requirement', () => {
  assert.match(ORIGINALITY_RULE, /original text in your own words/);
  assert.match(ORIGINALITY_RULE, /Never reproduce or closely paraphrase existing papers, articles, theses, books, sample essays/);
  assert.match(ORIGINALITY_RULE, /short quotation[^\n]*in quotation marks, with its citation/);
  assert.match(ORIGINALITY_RULE, /Cite every idea, finding or figure you take from a source/);
  assert.match(ORIGINALITY_RULE, /Never fabricate sources, references, data, statistics, results or quotations/);
  assert.match(ORIGINALITY_RULE, /passed off as the student's own, do not do that part/);
  assert.match(ORIGINALITY_RULE, /offer to write original content/);
  // It must never loosen a feature's own, stricter rules.
  assert.match(ORIGINALITY_RULE, /never relax a stricter instruction/);
});

test('the rule is added after a system prompt, once, leaving the prompt intact', () => {
  assert.equal(withOriginalityRule(), ORIGINALITY_RULE);
  assert.equal(withOriginalityRule('  '), ORIGINALITY_RULE);
  const once = withOriginalityRule('You are a tutor.');
  assert.ok(once.startsWith('You are a tutor.\n\n'));
  assert.ok(once.endsWith(ORIGINALITY_RULE));
  assert.equal(withOriginalityRule(once), once);
});

// Every system prompt a writing feature sends, with a rule of its own that must survive.
const FEATURES: [feature: string, systemPrompt: string | undefined, ownRule: RegExp | null][] = [
  ['guided care study draft', GUIDED_CARE_STUDY_PROMPT, /Never invent patient data, dates, measurements, treatments or outcomes/],
  ['guided care study help and review', CARE_STUDY_RULES, /Never fill a gap with a typical, normal or likely value/],
  ['model care study chapters, review and fixes', MODEL_CARE_STUDY_PROMPT, /Use only the facts in the CASE RECORD/],
  ['writing assist', WORKSPACE_SYSTEM_PROMPT, /Maintain the researcher's voice/],
  ['editor AI', INLINE_SYSTEM_PROMPT, /Never\s+invent new citations or references/],
  ['coach', COACH_SYSTEM_PROMPT, /Never write sentences or paragraphs the student could paste/],
  ['notebook', NOTEBOOK_SYSTEM_PROMPT, /Use only information that is in the excerpts/],
  ['paper supervision', buildSupervisionSystemPrompt('Malaria in Ghana', 'Nursing', 'university', 8000, []), /only these may be cited/],
  // Chapters, plans, abstracts, topics, questions, case values, suggestions: no system prompt of their own.
  ['paper chapters and other single-prompt calls', undefined, null],
];

for (const [feature, own, ownRule] of FEATURES) {
  test(`${feature}: the model gets the originality rule and keeps its own rules`, () => {
    const sent = systemPromptFor({ systemPrompt: own })!;
    assert.ok(sent.includes(ORIGINALITY_RULE), `${feature} is sent without the originality rule`);
    if (own && ownRule) {
      assert.ok(sent.startsWith(own.trim()), `${feature}'s own system prompt was changed`);
      assert.match(sent, ownRule);
    }
  });
}

test('only verbatim parsing calls may opt out of the rule', () => {
  assert.ok(!systemPromptFor({ systemPrompt: 'Parse.', originality: false }).includes(ORIGINALITY_RULE));
  assert.ok(systemPromptFor({ systemPrompt: 'Parse.', originality: false }).startsWith('Parse.\n\n'));
  assert.ok(!systemPromptFor({ originality: false }).includes(ORIGINALITY_RULE));
});

/** Source files under src, excluding tests and declaration files. */
function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.d.ts') ? [path] : [];
  });
}

test('every model call goes through the gateway, which adds the rule', () => {
  // The gateway owns the model clients; perplexity-agent.ts is the client it uses for research.
  // perplexity-search.ts is Perplexity's web search, which returns published pages, not model text.
  const owners = [
    join('services', 'ai', 'gateway.service.ts'),
    join('services', 'ai', 'perplexity-agent.ts'),
    join('services', 'ai', 'perplexity-search.ts'),
  ];
  const MODEL_CLIENT = /from ['"](@anthropic-ai\/sdk|openai|[^'"]*\/perplexity-agent(\.js)?)['"]/;
  const MODEL_ENDPOINT = /api\.anthropic\.com|\/v1\/messages|chat\/completions|api\.perplexity\.ai/;
  const offenders = sourceFiles()
    .filter((path) => !owners.includes(relative(SRC, path)))
    .filter((path) => {
      const code = readFileSync(path, 'utf8');
      return MODEL_CLIENT.test(code) || MODEL_ENDPOINT.test(code);
    })
    .map((path) => relative(SRC, path));
  assert.deepEqual(offenders, [], `These files reach a model without the gateway: ${offenders.join(', ')}`);
});

test('no writing feature opts out of the rule', () => {
  // Both copy text out verbatim (reference strings, a document's title and authors) and write nothing for the student.
  const allowed = [
    join('services', 'citations', 'verify', 'extractor.service.ts'),
    join('services', 'notebook', 'metadata.service.ts'),
  ];
  const optOuts = sourceFiles()
    .filter((path) => /originality:\s*false/.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SRC, path))
    .filter((file) => !allowed.includes(file));
  assert.deepEqual(optOuts, [], `Only verbatim parsing may skip the originality rule: ${optOuts.join(', ')}`);
});
