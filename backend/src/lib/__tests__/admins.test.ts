import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isAdminPhone } from '../admins.js';

const saved = { one: process.env.ADMIN_PHONE, many: process.env.ADMIN_PHONES };

afterEach(() => {
  process.env.ADMIN_PHONE = saved.one;
  process.env.ADMIN_PHONES = saved.many;
  if (saved.one === undefined) delete process.env.ADMIN_PHONE;
  if (saved.many === undefined) delete process.env.ADMIN_PHONES;
});

test('isAdminPhone matches ADMIN_PHONE in any Ghanaian format', () => {
  process.env.ADMIN_PHONE = '0244123456';
  delete process.env.ADMIN_PHONES;
  assert.equal(isAdminPhone('+233244123456'), true);
  assert.equal(isAdminPhone('233 24 412 3456'), true);
  assert.equal(isAdminPhone('0244123457'), false);
});

test('isAdminPhone reads a comma-separated ADMIN_PHONES list', () => {
  delete process.env.ADMIN_PHONE;
  process.env.ADMIN_PHONES = '+233244123456, 0501112222';
  assert.equal(isAdminPhone('0501112222'), true);
  assert.equal(isAdminPhone('0244123456'), true);
});

test('isAdminPhone is false when no admin phones are configured', () => {
  delete process.env.ADMIN_PHONE;
  delete process.env.ADMIN_PHONES;
  assert.equal(isAdminPhone('0244123456'), false);
  assert.equal(isAdminPhone(undefined), false);
  assert.equal(isAdminPhone(''), false);
});
