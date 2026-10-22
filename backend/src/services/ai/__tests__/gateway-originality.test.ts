import { before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { ORIGINALITY_RULE } from '../originality.js';

// A fake Anthropic and Perplexity, set up before anything loads the gateway, so
// these tests reach no real model, database or Redis whatever the local .env holds.
Object.assign(process.env, {
  AI_OFFLINE: 'false',
  ANTHROPIC_API_KEY: 'test-key',
  OPENAI_API_KEY: '',
  PERPLEXITY_API_KEY: 'test-key',
  REDIS_URL: '',
  SUPABASE_URL: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
});

/** System prompts as the providers received them, in call order. */
let sent: string[] = [];

const json = (body: unknown, type = 'application/json') => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, headers: { 'content-type': type } });

const sse = (events: Record<string, unknown>[]) =>
  json(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), 'text/event-stream');

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/v1/messages')) throw new Error(`Unexpected request in a test: ${url}`);
  const body = JSON.parse(String(init?.body));
  sent.push(Array.isArray(body.system) ? body.system.map((b: { text: string }) => b.text).join('') : body.system ?? '');
  const message = { id: 'msg_test', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } };
  if (!body.stream) return json({ ...message, content: [{ type: 'text', text: 'Original text.' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 3 } });
  return sse([
    { type: 'message_start', message },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Original text.' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 3 } },
    { type: 'message_stop' },
  ]);
}) as typeof fetch;

let ai: typeof import('../gateway.service.js');
let router: typeof import('../router.service.js');

before(async () => {
  const axios = (await import('axios')).default;
  // Perplexity takes one input: the system prompt goes in front of the question.
  axios.post = (async (_url: string, body: { input: string }) => {
    sent.push(body.input);
    return { data: { output_text: 'Current findings.', output: [], usage: {} } };
  }) as typeof axios.post;
  ai = await import('../gateway.service.js');
  router = await import('../router.service.js');
});

beforeEach(() => {
  sent = [];
});

/** The one system prompt the last call sent, checked for the rule. */
function assertRuleSent(feature: string, own?: string) {
  assert.equal(sent.length, 1, `${feature} made ${sent.length} model calls`);
  assert.ok(sent[0].includes(ORIGINALITY_RULE), `${feature} reached the model without the originality rule`);
  if (own) assert.ok(sent[0].startsWith(own.trim()), `${feature}'s own system prompt did not reach the model intact`);
}

test('Complete Paper chapters carry the rule (no system prompt of their own)', async () => {
  const { draftChapter } = await import('../../pipeline/draft.service.js');
  const paper = { topic: 'Malaria in Ghana', course: 'Nursing', institution_name: 'UCC', programme: 'BSc Nursing', institution_type: 'university' };
  await draftChapter(1, 'INTRODUCTION', ['1.1 Background'], 300, paper, 'Context.', '', []);
  assertRuleSent('Chapter drafting');
});

test('paper abstracts carry the rule', async () => {
  const { generateAbstract } = await import('../../pipeline/assemble.service.js');
  await generateAbstract('CHAPTER 1\nText.', { topic: 'Malaria in Ghana', institution_type: 'university' });
  assertRuleSent('Abstract');
});

test('writing assist carries the rule on top of its own prompt', async () => {
  const { assistWithText, WORKSPACE_SYSTEM_PROMPT } = await import('../workspace-assist.service.js');
  await assistWithText('Mobile phones help learning.', 'rewrite');
  assertRuleSent('Writing assist', WORKSPACE_SYSTEM_PROMPT);
});

test('guided care studies carry the rule and keep the rule against inventing clinical facts', async () => {
  const { defaultGenerate } = await import('../../care-study/care-study.service.js');
  const { CARE_STUDY_SYSTEM_PROMPT } = await import('../../care-study/prompts.js');
  await defaultGenerate()('SECTION TO WRITE: Introduction', { tier: 'drafting', maxTokens: 500, action: 'care-study-draft' });
  assertRuleSent('Care study draft', CARE_STUDY_SYSTEM_PROMPT);
  assert.match(sent[0], /Never invent patient data/);
});

test('supervision carries the rule', async () => {
  await router.routeSupervision('CHAPTER TO REVISE:\nText.', { systemPrompt: 'You are a supervisor.', maxTokens: 500 });
  assertRuleSent('Supervision', 'You are a supervisor.');
});

test('streamed features (editor AI, coach, notebook) carry the rule', async () => {
  const { INLINE_SYSTEM_PROMPT } = await import('../inline-ai.service.js');
  const { COACH_SYSTEM_PROMPT } = await import('../../workspace/study-draft.service.js');
  const { NOTEBOOK_SYSTEM_PROMPT } = await import('../../notebook/notebook-ai.js');
  for (const [feature, systemPrompt] of [['Editor AI', INLINE_SYSTEM_PROMPT], ['Coach', COACH_SYSTEM_PROMPT], ['Notebook', NOTEBOOK_SYSTEM_PROMPT]]) {
    sent = [];
    let streamed = '';
    await ai.aiStream({ prompt: 'Help me.', tier: 'drafting', systemPrompt, cachePrompt: true, maxTokens: 500 }, (t) => { streamed += t; });
    assert.equal(streamed, 'Original text.');
    assertRuleSent(feature, systemPrompt);
  }
});

test('web research carries the rule', async () => {
  const { searchPerplexity } = await import('../perplexity.service.js');
  assert.equal(await searchPerplexity('Malaria in Ghana'), 'Current findings.');
  assertRuleSent('Research');
});

test('a verbatim parsing call that opts out is sent without the rule', async () => {
  await ai.aiCall({ prompt: 'Parse this reference.', tier: 'light', maxTokens: 300, originality: false });
  assert.deepEqual(sent, ['']);
});
