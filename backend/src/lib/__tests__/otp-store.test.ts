import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeOtp, consumeOtp, MAX_OTP_ATTEMPTS } from '../otp-store.js';

// No REDIS_URL in tests, so these exercise the in-memory store.

test('the right code works once', async () => {
  await storeOtp('test', '+233240000001', '123456');
  assert.equal(await consumeOtp('test', '+233240000001', '123456'), 'valid');
  assert.equal(await consumeOtp('test', '+233240000001', '123456'), 'invalid');
});

test('wrong codes lock the number after the attempt limit, even with the right code', async () => {
  const phone = '+233240000002';
  await storeOtp('test', phone, '654321');
  for (let i = 1; i < MAX_OTP_ATTEMPTS; i++) {
    assert.equal(await consumeOtp('test', phone, '000000'), 'invalid');
  }
  assert.equal(await consumeOtp('test', phone, '000000'), 'locked');
  assert.equal(await consumeOtp('test', phone, '654321'), 'locked');
});

test('the last allowed attempt can still be the right code', async () => {
  const phone = '+233240000003';
  await storeOtp('test', phone, '111222');
  for (let i = 1; i < MAX_OTP_ATTEMPTS; i++) await consumeOtp('test', phone, '999999');
  assert.equal(await consumeOtp('test', phone, '111222'), 'valid');
});

test('a new code resets the attempt count', async () => {
  const phone = '+233240000004';
  await storeOtp('test', phone, '222333');
  for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) await consumeOtp('test', phone, '000000');
  assert.equal(await consumeOtp('test', phone, '222333'), 'locked');
  await storeOtp('test', phone, '444555');
  assert.equal(await consumeOtp('test', phone, '444555'), 'valid');
});

test('attempts on one number do not affect another', async () => {
  await storeOtp('test', '+233240000005', '777888');
  await storeOtp('test', '+233240000006', '777888');
  for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) await consumeOtp('test', '+233240000005', '000000');
  assert.equal(await consumeOtp('test', '+233240000006', '777888'), 'valid');
});
