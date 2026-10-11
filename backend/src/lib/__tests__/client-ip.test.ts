import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import { resolveClientIp, PROXY_SECRET_HEADER } from '../client-ip.js';

const SECRET = 'a-long-shared-proxy-secret-value';

const req = (headers: Record<string, string>, remote = '10.24.43.5') =>
  ({ headers, socket: { remoteAddress: remote } }) as unknown as Request;

beforeEach(() => {
  process.env.API_PROXY_SECRET = SECRET;
});

test('trusts Vercel forwarded headers only with the proxy secret', () => {
  const viaVercel = req({
    [PROXY_SECRET_HEADER]: SECRET,
    'x-vercel-forwarded-for': '197.251.240.3',
    'x-forwarded-for': '197.251.240.3, 76.76.21.9',
    'cf-connecting-ip': '76.76.21.9',
  });
  assert.deepEqual(resolveClientIp(viaVercel), { ip: '197.251.240.3', source: 'vercel' });
});

test('a forged forwarded header without the secret is ignored', () => {
  const forged = req({
    'x-vercel-forwarded-for': '1.2.3.4',
    'x-forwarded-for': '1.2.3.4',
    'cf-connecting-ip': '197.251.240.3',
  });
  assert.deepEqual(resolveClientIp(forged), { ip: '197.251.240.3', source: 'cloudflare' });
});

test('a wrong secret is treated like no secret', () => {
  const wrong = req({ [PROXY_SECRET_HEADER]: 'guess', 'x-real-ip': '1.2.3.4', 'cf-connecting-ip': '41.66.0.1' });
  assert.equal(resolveClientIp(wrong).ip, '41.66.0.1');
});

test('an unset or short backend secret never trusts the header', () => {
  process.env.API_PROXY_SECRET = '';
  // Vercel sends the literal "$API_PROXY_SECRET" when its env var is missing.
  const literal = req({ [PROXY_SECRET_HEADER]: '$API_PROXY_SECRET', 'x-real-ip': '1.2.3.4', 'cf-connecting-ip': '41.66.0.1' });
  assert.equal(resolveClientIp(literal).source, 'cloudflare');
});

test('falls back to the socket address and normalises IPv4-mapped IPv6', () => {
  assert.deepEqual(resolveClientIp(req({}, '::ffff:10.24.43.5')), { ip: '10.24.43.5', source: 'socket' });
});

test('ignores values that are not IP addresses', () => {
  const junk = req({ 'cf-connecting-ip': 'not-an-ip', 'true-client-ip': '2001:db8::1' });
  assert.deepEqual(resolveClientIp(junk), { ip: '2001:db8::1', source: 'cloudflare' });
});
