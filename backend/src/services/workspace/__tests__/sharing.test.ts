import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SharingError, cleanComment, isShareRole, openShare, wordCount } from '../sharing.service.js';

test('a comment needs text and, unless it is a reply, the passage it is about', () => {
  assert.deepEqual(cleanComment({ body: '  Cite a source here. ', anchorText: 'Most traders save', occurrence: 1 }), {
    body: 'Cite a source here.', parentId: null, anchorText: 'Most traders save', occurrence: 1,
  });
  // A reply belongs to its parent, so it has no passage of its own.
  const reply = cleanComment({ body: 'Done, thanks.', parentId: '0d7f6c1e-1111-4a2b-9c3d-123456789abc', anchorText: 'ignored' });
  assert.equal(reply.anchorText, '');
  assert.throws(() => cleanComment({ body: '   ', anchorText: 'x' }), SharingError);
  assert.throws(() => cleanComment({ body: 'No passage' }), /Select the text/);
  assert.equal(cleanComment({ body: 'x'.repeat(5_000), anchorText: 'a' }).body.length, 2_000);
  assert.equal(cleanComment({ body: 'ok', anchorText: 'a', occurrence: -3 }).occurrence, 0);
  assert.equal(cleanComment({ body: 'ok', parentId: 'not-an-id', anchorText: 'a' }).parentId, null);
});

test('share roles and word counts', () => {
  assert.ok(isShareRole('view') && isShareRole('comment') && isShareRole('edit'));
  assert.ok(!isShareRole('admin') && !isShareRole(undefined));
  assert.equal(wordCount('<h1>Chapter One</h1><p>Mobile money&nbsp;has <strong>changed</strong> trade.</p>'), 7);
  assert.equal(wordCount(''), 0);
});

test('a malformed link is turned away before the database is asked', async () => {
  await assert.rejects(openShare('../../etc'), (err: unknown) => err instanceof SharingError && err.status === 404);
  await assert.rejects(openShare('short'), (err: unknown) => err instanceof SharingError && err.status === 404);
});
