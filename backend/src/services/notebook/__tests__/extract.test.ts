import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { extractDocx, extractUrl, htmlToText, isPublicAddress } from '../extract.service.js';
import { buildChatPrompt, buildOutputPrompt, isNotebookOutput } from '../notebook-ai.js';

test('isPublicAddress blocks private, loopback and link-local ranges', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '172.16.5.4', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ['8.8.8.8', '41.66.10.1', '172.32.0.1', '2001:4860:4860::8888']) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
});

test('extractUrl refuses private hosts and non-web schemes', async () => {
  await assert.rejects(extractUrl('http://127.0.0.1/admin'), /private network/);
  await assert.rejects(extractUrl('http://169.254.169.254/latest/meta-data'), /private network/);
  await assert.rejects(extractUrl('file:///etc/passwd'), /Only http and https/);
  await assert.rejects(extractUrl('not a url'), /not a valid/);
});

test('htmlToText keeps the readable text and title, drops scripts and navigation', () => {
  const { title, text } = htmlToText(`<html><head><title>Mobile &amp; learning</title><script>alert(1)</script></head>
    <body><nav>Home | About</nav><h1>Findings</h1><p>Access rose by 30%.</p><p>Rural&nbsp;schools lag.</p><footer>©</footer></body></html>`);
  assert.equal(title, 'Mobile & learning');
  assert.match(text, /Findings\nAccess rose by 30%\.\nRural schools lag\./);
  assert.doesNotMatch(text, /alert|Home \| About/);
});

test('extractDocx reads paragraphs from a Word document', async () => {
  const zip = new JSZip();
  zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>First paragraph &amp; more.</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p></w:body></w:document>');
  const text = await extractDocx(await zip.generateAsync({ type: 'nodebuffer' }));
  assert.equal(text, 'First paragraph & more.\nSecond');
  await assert.rejects(extractDocx(Buffer.from('not a zip')), /Couldn't read that file/);
});

const excerpt = {
  n: 1,
  passages: ['Mobile learning improved access in Ashanti.'],
  source: { id: 's1', title: 'Owusu handout', kind: 'pdf' as const, url: null, authors: 'Owusu, K.', year: 2021, char_count: 10, chunk_count: 1, created_at: '' },
};

test('chat prompt numbers sources and keeps recent history only', () => {
  const history = Array.from({ length: 10 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `turn ${i}` }));
  const prompt = buildChatPrompt('What changed?', [excerpt], history, 'My paper');
  assert.match(prompt, /\[1\] Owusu handout \(Owusu, K\., 2021\)\n> Mobile learning improved access/);
  assert.match(prompt, /turn 9/);
  assert.doesNotMatch(prompt, /turn 3\b/);
  assert.match(prompt, /QUESTION: What changed\?/);
});

test('output prompts exist for each kind', () => {
  assert.equal(isNotebookOutput('matrix'), true);
  assert.equal(isNotebookOutput('essay'), false);
  assert.match(buildOutputPrompt('matrix', [excerpt], 'My paper'), /literature review matrix/);
});
