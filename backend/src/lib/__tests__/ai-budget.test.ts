import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AiBudgetError, assertBudget, dailyLimitUsd, getBudget, recordSpend } from '../ai-budget.js';
import { closeRedis } from '../redis.js';

// A local REDIS_URL opens a connection that would keep the test process alive.
after(() => closeRedis());

test('plan allowances rise with the plan', () => {
  assert.ok(dailyLimitUsd('free') < dailyLimitUsd('standard'));
  assert.ok(dailyLimitUsd('standard') < dailyLimitUsd('premium'));
});

test('system jobs (no user) are never blocked', async () => {
  await assertBudget(undefined);
});

test('spend accumulates and blocks once the allowance is used', async () => {
  const userId = randomUUID(); // unknown user: no usage logged today
  const before = await getBudget(userId);
  assert.equal(before.spentUsd, 0);

  await recordSpend(userId, 0.05);
  const after = await getBudget(userId);
  assert.ok(Math.abs(after.spentUsd - 0.05) < 1e-9);
  await assertBudget(userId); // still has allowance

  await recordSpend(userId, before.limitUsd);
  await assert.rejects(assertBudget(userId), (err: unknown) => err instanceof AiBudgetError && err.status === 429);
});
