import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../../../config/index.js';
import { CollabDenied, authorize } from '../collab.service.js';

// Both are refused before the database is asked anything.
const DOC = '30b448c3-19ff-43cd-91e4-c580292e0e55';

test('only real document ids can be joined live', async () => {
  const token = jwt.sign({ id: 'u1', phone: '+233200000001' }, CONFIG.JWT_SECRET, { algorithm: 'HS256' });
  await assert.rejects(authorize('../../etc/passwd', token, null), CollabDenied);
  await assert.rejects(authorize('', token, null), CollabDenied);
});

test('joining live needs a valid sign-in', async () => {
  await assert.rejects(authorize(DOC, '', 'someLinkToken1234567'), CollabDenied);
  await assert.rejects(authorize(DOC, 'not-a-jwt', null), CollabDenied);
  const forged = jwt.sign({ id: 'u1' }, 'some-other-secret', { algorithm: 'HS256' });
  await assert.rejects(authorize(DOC, forged, null), /Sign in again/);
  const noId = jwt.sign({ phone: '+233200000001' }, CONFIG.JWT_SECRET, { algorithm: 'HS256' });
  await assert.rejects(authorize(DOC, noId, null), CollabDenied);
});
