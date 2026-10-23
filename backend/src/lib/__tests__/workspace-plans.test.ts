import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PLAN_LIMITS, devPlan, limitsJson } from '../workspace-plans.js';
import { attachPlan, requirePaidPlan, requirePremium } from '../../middleware/subscription.middleware.js';
import { assist, assistAdvanced, autocomplete } from '../../controllers/workspace.controller.js';
import { countAutocomplete } from '../../services/workspace/autocomplete.service.js';
import { closeRedis } from '../redis.js';

after(() => closeRedis());

/** Just enough of an Express response to read what a handler sent. */
function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; return res; },
  };
  return res;
}
const call = async (handler: (req: any, res: any, next?: any) => unknown, req: any) => {
  const res = fakeRes();
  let nextCalled = false;
  await handler(req, res, () => { nextCalled = true; });
  return { ...res, nextCalled };
};
const freeUser = () => ({ user: { id: randomUUID() }, plan: 'free', subscription: null });

test('each plan includes more than the one below it', () => {
  assert.deepEqual(limitsJson('free'), { documents: 2, sourcesPerDocument: 3, autocompletesPerDay: 10 });
  assert.deepEqual(limitsJson('standard'), { documents: 5, sourcesPerDocument: 10, autocompletesPerDay: null });
  assert.deepEqual(limitsJson('premium'), { documents: null, sourcesPerDocument: 20, autocompletesPerDay: null });
  for (const key of ['documents', 'sourcesPerDocument', 'autocompletesPerDay'] as const) {
    assert.ok(PLAN_LIMITS.free[key] <= PLAN_LIMITS.standard[key] && PLAN_LIMITS.standard[key] <= PLAN_LIMITS.premium[key], key);
  }
});

test('in development everyone is Premium unless DEV_PLAN picks another plan', async () => {
  const saved = process.env.DEV_PLAN;
  try {
    delete process.env.DEV_PLAN;
    assert.equal(devPlan(), 'premium');
    process.env.DEV_PLAN = 'free';
    assert.equal(devPlan(), 'free');
    const req: any = { user: { id: randomUUID() } };
    const res = await call(attachPlan, req);
    assert.ok(res.nextCalled, 'a Free user still gets into the Workspace');
    assert.equal(req.plan, 'free');
    assert.equal(req.subscription, null);
    process.env.DEV_PLAN = 'standard';
    const std: any = { user: { id: randomUUID() } };
    await call(attachPlan, std);
    assert.equal(std.plan, 'standard');
  } finally {
    if (saved === undefined) delete process.env.DEV_PLAN; else process.env.DEV_PLAN = saved;
  }
});

test('paid and Premium features turn Free users away with a code the app understands', async () => {
  const paid = await call(requirePaidPlan, freeUser());
  assert.equal(paid.statusCode, 403);
  assert.equal(paid.body.code, 'PLAN_REQUIRED');
  assert.ok((await call(requirePaidPlan, { plan: 'standard', subscription: { plan: 'standard' } })).nextCalled);
  assert.equal((await call(requirePremium, { plan: 'standard', subscription: { plan: 'standard' } })).body.code, 'PREMIUM_REQUIRED');
});

test('Free gets the quick edits and the free checks, not the bigger AI actions', async () => {
  for (const instruction of ['continue', 'expand', 'outline', 'abstract', 'Write my introduction']) {
    const res = await call(assist, { ...freeUser(), body: { instruction, selectedText: 'Some text.' } });
    assert.equal(res.statusCode, 403, instruction);
    assert.equal(res.body.code, 'PLAN_REQUIRED');
  }
  for (const action of ['claims', 'validate-claim', 'plagiarism', 'rag-enhance']) {
    const res = await call(assistAdvanced, { ...freeUser(), body: { action, text: 'Some text.' } });
    assert.equal(res.statusCode, 403, action);
  }
  // The grammar check runs without an AI model, so Free has it.
  const grammar = await call(assistAdvanced, { ...freeUser(), body: { action: 'grammar', text: 'This are a sentence with error.' } });
  assert.equal(grammar.statusCode, 200);
  assert.equal(grammar.body.action, 'grammar');
});

test('Free autocomplete stops after ten suggestions a day, before any AI call', async () => {
  const req: any = { ...freeUser(), body: { before: 'Mobile money has changed how traders in Kumasi save their money' } };
  for (let i = 0; i < PLAN_LIMITS.free.autocompletesPerDay; i++) await countAutocomplete(req.user.id);
  const res = await call(autocomplete, req);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, 'AUTOCOMPLETE_LIMIT');
  assert.match(res.body.error, /today's 10 free autocompletes/);

  // Too little text to continue: no suggestion and nothing counted.
  const short = await call(autocomplete, { ...freeUser(), body: { before: 'Mobile money' } });
  assert.deepEqual(short.body, { suggestion: null, remaining: null });
});
