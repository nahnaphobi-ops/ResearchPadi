import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftOutline, outlineToHtml, draftSections, findDraftSection, buildCoachPrompt } from '../study-draft.service.js';

const draft = `This study examined mobile money use among traders in Kumasi.
Keywords: mobile money, savings

CHAPTER 1
INTRODUCTION
1.1 Background to the Study
Mobile money has spread quickly in Ghana (Mensah, 2021).
2.5 million households now use it.
1.2 Statement of the Problem
Few traders save with it.

**CHAPTER 2: LITERATURE REVIEW**
2.1 Introduction
This chapter reviews the literature.
2.2 Financial Inclusion in Ghana
Text about inclusion.
3.4 Sample size was calculated using Krejcie and Morgan.

References

Mensah, K. (2021). Mobile money. Journal.`;

test('outline finds chapters (one or two lines) and their sections only', () => {
  const outline = draftOutline(draft);
  assert.deepEqual(outline.map((o) => o.text), [
    'CHAPTER 1: INTRODUCTION',
    '1.1 Background to the Study',
    '1.2 Statement of the Problem',
    'CHAPTER 2: LITERATURE REVIEW',
    '2.1 Introduction',
    '2.2 Financial Inclusion in Ghana',
    'References',
  ]);
});

test('word chapter numbers work too', () => {
  const outline = draftOutline('CHAPTER ONE: CLIENT PROFILE\n1.1 Introduction\ntext\n1.2 Social History\ntext');
  assert.deepEqual(outline.map((o) => o.number), ['1', '1.1', '1.2']);
});

test('the new document has headings and empty paragraphs, never the draft text', () => {
  const html = outlineToHtml('Mobile money & traders — my version', draftOutline(draft), true);
  assert.ok(html.startsWith('<h1>Mobile money &amp; traders — my version</h1>'));
  assert.ok(html.includes('<h1>Abstract</h1>'));
  assert.ok(html.includes('<h2>1.1 Background to the Study</h2><p></p>'));
  assert.ok(!html.includes('spread quickly'));
  assert.ok(!html.includes('2.5 million'));
});

test('sections carry their own text, and References is left out', () => {
  const sections = draftSections(draft);
  const bg = sections.find((s) => s.number === '1.1');
  assert.ok(bg?.text.includes('Mobile money has spread quickly'));
  assert.ok(bg?.text.includes('2.5 million'));
  assert.ok(!sections.some((s) => s.heading === 'References'));
});

test('a section is found by its number whatever the heading wording', () => {
  assert.match(findDraftSection(draft, '2.2 Inclusion')?.text ?? '', /Text about inclusion/);
  assert.equal(findDraftSection(draft, '9.9 Nothing'), undefined);
});

test('coach prompts ask for pointers, not text to paste', () => {
  const guide = buildCoachPrompt({ mode: 'guide', heading: '1.1 Background', draftSection: 'draft text' });
  assert.match(guide, /Points to cover/);
  assert.match(guide, /do not copy/);
  const feedback = buildCoachPrompt({ mode: 'feedback', heading: '1.1 Background', studentText: 'My words here.' });
  assert.match(feedback, /THE STUDENT'S OWN TEXT:\nMy words here\./);
  assert.match(feedback, /never a rewrite/);
});
