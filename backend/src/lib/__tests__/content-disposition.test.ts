import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { attachmentDisposition } from '../content-disposition.js';

/** Node's own header check: throws on anything it would refuse to send. */
function assertValidHeader(value: string) {
  http.validateHeaderValue('Content-Disposition', value);
}

test('topics with curly quotes and long dashes give a header Node accepts', () => {
  for (const topic of ['Women’s health in Ghana', 'Impact of “mobile money” on SMEs', 'Cocoa farming — a case study', 'Étude de cas']) {
    const value = attachmentDisposition(topic, '.docx');
    assert.doesNotThrow(() => assertValidHeader(value), topic);
  }
});

test('the ASCII filename keeps a readable name and the full name is UTF-8 encoded', () => {
  const value = attachmentDisposition('Women’s health in Ghana', '.docx');
  assert.ok(value.includes(`filename="Women's_health_in_Ghana.docx"`));
  assert.ok(value.includes(`filename*=UTF-8''Women%E2%80%99s_health_in_Ghana.docx`));
});

test('quotes and backslashes cannot break out of the quoted filename', () => {
  const value = attachmentDisposition('A "quoted" \\ topic', '.docx');
  const quoted = value.match(/filename="([^"]*)"/)?.[1];
  assert.equal(quoted, 'A_quoted__topic.docx');
});

test('empty or symbol-only topics still get a filename', () => {
  assert.ok(attachmentDisposition('   ', '.docx').includes('filename="download.docx"'));
  assert.ok(attachmentDisposition('“”', '.docx').includes('filename="download.docx"'));
});

test('very long topics are shortened', () => {
  const value = attachmentDisposition('word '.repeat(100), '.docx');
  const quoted = value.match(/filename="([^"]*)"/)?.[1] ?? '';
  assert.ok(quoted.length <= 105);
});
