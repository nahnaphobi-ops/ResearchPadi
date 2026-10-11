import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitPaper } from '../supervise.service.js';

const paper = [
  'This study examined mobile learning in Ghanaian senior high schools.',
  '',
  'CHAPTER 1: INTRODUCTION',
  '1.1 Background',
  'Intro text. The objectives of the study are to assess access.',
  '',
  '**CHAPTER 2: LITERATURE REVIEW**',
  '2.1 Concepts',
  'Review text.',
  '',
  '## CHAPTER 3 — METHODOLOGY',
  'Method text.',
  '',
  'References',
  'Mensah, K. (2021). A title. Journal.',
].join('\n');

test('splitPaper separates abstract, chapters and references', () => {
  const parts = splitPaper(paper);
  assert.ok(parts);
  assert.equal(parts.head, 'This study examined mobile learning in Ghanaian senior high schools.');
  assert.deepEqual(parts.info.map((c) => [c.num, c.title]), [
    [1, 'INTRODUCTION'],
    [2, 'LITERATURE REVIEW'],
    [3, 'METHODOLOGY'],
  ]);
  assert.ok(parts.chapters[0].startsWith('CHAPTER 1: INTRODUCTION'));
  assert.ok(parts.chapters[2].endsWith('Method text.'));
  assert.ok(parts.tail.startsWith('References'));
  // Nothing is lost when the parts are put back together.
  const rejoined = [parts.head, ...parts.chapters, parts.tail].join('\n\n').replace(/\s+/g, ' ');
  assert.equal(rejoined, paper.replace(/\s+/g, ' ').trim());
});

test('splitPaper returns null when there are no chapter headings', () => {
  assert.equal(splitPaper('Just some text with no chapters.'), null);
});
