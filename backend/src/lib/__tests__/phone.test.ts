import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGhanaMsisdn } from '../phone.js';
import { claimOtpCooldown, releaseOtpCooldown, normalizePhone } from '../otp-store.js';

test('normalizePhone gives every Ghanaian format the same account key', () => {
  for (const input of ['0244123456', '+233244123456', '233 24 412 3456', ' 024-412-3456 ']) {
    assert.equal(normalizePhone(input), '+233244123456', input);
  }
});

test('toGhanaMsisdn accepts common Ghanaian formats', () => {
  for (const input of ['0244123456', '244123456', '+233244123456', '233244123456', '00233244123456', '024 412 3456', '024-412-3456']) {
    assert.equal(toGhanaMsisdn(input), '233244123456', input);
  }
  assert.equal(toGhanaMsisdn('0501234567'), '233501234567');
});

test('toGhanaMsisdn rejects invalid numbers', () => {
  for (const input of ['', '12345', '02441234567', '+234803123456', '0344123456', 'abc0244123456', '2332441234567']) {
    assert.equal(toGhanaMsisdn(input), null, input);
  }
});

test('claimOtpCooldown blocks a repeat send until released', async () => {
  const id = `test-${Date.now()}`;
  assert.equal(await claimOtpCooldown('test', id, 60_000), true);
  assert.equal(await claimOtpCooldown('test', id, 60_000), false);
  await releaseOtpCooldown('test', id);
  assert.equal(await claimOtpCooldown('test', id, 60_000), true);
});
