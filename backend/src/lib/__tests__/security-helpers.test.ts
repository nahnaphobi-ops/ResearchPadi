import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { sanitizeIlikeTerm, ilikeContains } from '../postgrest-filter.js';
import { verifyPaystackSignature, paystackAmountToGhs } from '../paystack-signature.js';
import { generateNumericOtp, normalizePhone } from '../otp-store.js';
import { chunkText } from '../../services/rag/chunker.service.js';

test('sanitizeIlikeTerm strips PostgREST or-filter metacharacters', () => {
  const injected = 'ada,phone.eq.0800,id.neq.0';
  const cleaned = sanitizeIlikeTerm(injected);
  assert.equal(cleaned.includes(','), false);
  assert.equal(cleaned.includes('.'), false);
  assert.ok(cleaned.includes('ada'));
});

test('sanitizeIlikeTerm strips ilike wildcards and truncates', () => {
  assert.equal(sanitizeIlikeTerm('%admin_'), 'admin');
  assert.equal(sanitizeIlikeTerm('a'.repeat(200)).length, 80);
});

test('ilikeContains wraps a sanitized term', () => {
  assert.equal(ilikeContains('kwame'), '%kwame%');
});

test('verifyPaystackSignature accepts a valid HMAC-SHA512', () => {
  const secret = 'sk_test_secret';
  const body = '{"event":"charge.success"}';
  const signature = crypto.createHmac('sha512', secret).update(body).digest('hex');
  assert.equal(verifyPaystackSignature(body, signature, secret), true);
});

test('verifyPaystackSignature rejects missing, wrong, or mismatched-length signatures', () => {
  const secret = 'sk_test_secret';
  const body = '{"event":"charge.success"}';
  assert.equal(verifyPaystackSignature(body, undefined, secret), false);
  assert.equal(verifyPaystackSignature(body, 'deadbeef', secret), false);
  assert.equal(verifyPaystackSignature(body, 'ab', ''), false);
});

test('paystackAmountToGhs converts pesewas', () => {
  assert.equal(paystackAmountToGhs(5050), 50.5);
});

test('generateNumericOtp is a 6-digit code', () => {
  const otp = generateNumericOtp();
  assert.match(otp, /^\d{6}$/);
});

test('normalizePhone strips whitespace', () => {
  assert.equal(normalizePhone(' +233 20 000 0000 '), '+233200000000');
});

test('chunkText does not infinite-loop when overlap >= size', () => {
  const chunks = chunkText('one two three four five six', 4, 4);
  assert.ok(chunks.length >= 1 && chunks.length < 20);
});
