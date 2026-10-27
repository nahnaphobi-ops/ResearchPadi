import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../../config/env.js';

/** Runs validateEnv with NODE_ENV set (or unset) and the other required vars present. */
function validateWith(nodeEnv: string | undefined) {
  const saved = { ...process.env };
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.JWT_SECRET = 'a-test-secret-that-is-at-least-32-characters-long';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    return validateEnv();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

test('validateEnv refuses to start without NODE_ENV', () => {
  const result = validateWith(undefined);
  assert.equal(result.valid, false);
  assert.ok(result.missing.some((m) => m.startsWith('NODE_ENV')));
});

test('validateEnv refuses a mistyped NODE_ENV', () => {
  for (const value of ['prod', 'staging', 'Production', '']) {
    const result = validateWith(value);
    assert.equal(result.valid, false, `NODE_ENV="${value}" should not start`);
  }
});

test('validateEnv accepts production, development and test', () => {
  for (const value of ['production', 'development', 'test']) {
    const result = validateWith(value);
    assert.ok(!result.missing.some((m) => m.startsWith('NODE_ENV')), `NODE_ENV="${value}" should be accepted`);
  }
});
