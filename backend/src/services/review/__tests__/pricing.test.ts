import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_MODEL_DEFAULTS } from '../../ai/models.js';
import { addCost, addUsage, costOf, hasPricing, loadPricing, usageFromApi, type PricingTable, type TokenUsage } from '../pricing.js';

// Fixed prices, so these tests don't change when pricing.json is edited.
const TABLE: PricingTable = {
  models: {
    haiku: {
      input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01,
      longPrompt: { overTokens: 100_000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 },
    },
    opus: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  },
};

const usage = (u: Partial<TokenUsage>): TokenUsage => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, ...u });
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test('flat-priced model: input and output at their own rates, GHS at the given rate', () => {
  const c = costOf('opus', usage({ inputTokens: 20_000, outputTokens: 6_000 }), 12.5, TABLE);
  close(c.usd, 0.08 + 0.12);
  close(c.ghs, 0.2 * 12.5);
  assert.equal(c.longPrompt, false);
});

test('cache reads and writes are priced separately from fresh input', () => {
  const c = costOf('opus', usage({ inputTokens: 1_000, cacheReadTokens: 10_000, cacheWriteTokens: 2_000, outputTokens: 500 }), 1, TABLE);
  close(c.usd, (1_000 * 4 + 10_000 * 0.2 + 2_000 * 5 + 500 * 20) / 1e6);
});

test('Haiku up to 100K prompt tokens uses the base prices', () => {
  const at = costOf('haiku', usage({ inputTokens: 100_000, outputTokens: 5_000 }), 1, TABLE);
  assert.equal(at.longPrompt, false);
  close(at.usd, (100_000 * 0.1 + 5_000 * 0.5) / 1e6);
});

test('Haiku over 100K prompt tokens switches every price, output included, to the long-prompt set', () => {
  const over = costOf('haiku', usage({ inputTokens: 100_001, outputTokens: 5_000 }), 1, TABLE);
  assert.equal(over.longPrompt, true);
  close(over.usd, (100_001 * 0.5 + 5_000 * 2.5) / 1e6);
});

test('cache reads and writes count toward the 100K threshold', () => {
  const c = costOf('haiku', usage({ inputTokens: 60_000, cacheReadTokens: 30_000, cacheWriteTokens: 15_000 }), 1, TABLE);
  assert.equal(c.longPrompt, true);
  close(c.usd, (60_000 * 0.5 + 30_000 * 0.05 + 15_000 * 0.625) / 1e6);
});

test('each call is priced on its own prompt: two 60K calls are not one 120K call', () => {
  const a = usage({ inputTokens: 60_000, outputTokens: 2_000 });
  const perCall = addCost(costOf('haiku', a, 1, TABLE), costOf('haiku', a, 1, TABLE));
  const summed = costOf('haiku', addUsage(a, a), 1, TABLE);
  assert.equal(perCall.longPrompt, false);
  assert.ok(perCall.usd < summed.usd);
});

test('a model missing from the table is an error, not a zero cost', () => {
  assert.throws(() => costOf('unknown-model', usage({ inputTokens: 1 }), 1, TABLE), /No price for model unknown-model/);
});

test('usage from the API: null counts become 0', () => {
  assert.deepEqual(
    usageFromApi({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: null }),
    { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
});

test('pricing.json prices every default review model', () => {
  const table = loadPricing();
  for (const model of Object.values(REVIEW_MODEL_DEFAULTS)) assert.ok(hasPricing(model, table), `${model} has no price`);
  const haiku = table.models[REVIEW_MODEL_DEFAULTS.reader];
  assert.equal(haiku.longPrompt?.overTokens, 100_000, 'the reader needs its long-prompt tier');
});
