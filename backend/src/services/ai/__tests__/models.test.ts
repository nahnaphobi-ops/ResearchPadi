import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAILOVER_CHAINS, MODELS, primaryModel, type ModelTier } from '../models.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TIERS = Object.keys(FAILOVER_CHAINS) as ModelTier[];

test('every failover chain points at registered models of its own tier', () => {
  for (const tier of TIERS) {
    assert.ok(FAILOVER_CHAINS[tier].length > 0, `${tier} has no models`);
    for (const id of FAILOVER_CHAINS[tier]) {
      const model = MODELS[id];
      assert.ok(model, `${tier} chain lists unknown model ${id}`);
      assert.equal(model.tier, tier, `${id} is a ${model.tier} model but sits in the ${tier} chain`);
      assert.equal(model.model, id, `${id} registry key and model id differ`);
      assert.ok(model.inputPricePer1M > 0 && model.outputPricePer1M > 0, `${id} has no price`);
    }
  }
});

test('writing tiers fall back to a different provider', () => {
  for (const tier of ['light', 'drafting', 'supervision'] as const) {
    const providers = new Set(FAILOVER_CHAINS[tier].map((id) => MODELS[id].provider));
    assert.ok(providers.size > 1, `${tier} has no cross-provider fallback`);
  }
});

test('cheaper tiers really are cheaper', () => {
  const cost = (tier: ModelTier) => {
    const m = primaryModel(tier);
    return m.inputPricePer1M + m.outputPricePer1M;
  };
  assert.ok(cost('light') < cost('drafting'), 'light tier costs as much as drafting');
  assert.ok(cost('drafting') < cost('supervision'), 'drafting tier costs as much as supervision');
});

test('no model IDs are hard-coded outside models.ts', () => {
  // Chat model IDs only; the embedding model is configured in config/index.ts.
  const MODEL_ID = /['"`](claude-[a-z0-9.-]+|gpt-\d[a-z0-9.-]*|o\d(-mini)?|sonar(-[a-z]+)?)['"`]/;
  const offenders: string[] = [];

  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== '__tests__' && name !== 'node_modules') walk(path);
      } else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && name !== 'models.ts') {
        readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
          if (MODEL_ID.test(line)) offenders.push(`${relative(SRC, path)}:${i + 1}: ${line.trim()}`);
        });
      }
    }
  };
  walk(SRC);

  assert.deepEqual(offenders, [], `Pick models through services/ai/models.ts instead:\n${offenders.join('\n')}`);
});
