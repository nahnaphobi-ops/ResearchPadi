import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from '../../services/rag/chunker.service.js';

test('chunkText breaks on sentence boundaries and carries overlap', () => {
  const text = 'Mobile money is widespread in Ghana. Traders in Kumasi use it daily. It helps record keeping. Credit access remains limited.';
  const chunks = chunkText(text, 12, 6);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) assert.match(c, /[.!?]$/, 'every chunk ends on a sentence boundary');
  assert.ok(chunks[1].startsWith('It helps') || chunks[1].includes('Traders'), 'next chunk repeats the previous sentence(s)');
});

test('chunkText splits a sentence longer than the window', () => {
  const long = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ');
  const chunks = chunkText(long, 10, 0);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].split(' ').length, 10);
});

test('chunkText handles empty input', () => {
  assert.deepEqual(chunkText('   '), []);
});
