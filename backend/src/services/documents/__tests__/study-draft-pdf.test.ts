import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFParse } from 'pdf-parse';
import { extractPdf } from '../../notebook/extract.service.js';
import { STUDY_DRAFT_HEADER, STUDY_DRAFT_METADATA, STUDY_DRAFT_NOTICE, markedLine, provenanceProperties } from '../docx.service.js';
import { generateStudyDraftPdf } from '../study-draft-pdf.service.js';
import { inline } from '../pdf.service.js';

const provenance = { paperId: 'paper-42', generatedAt: '2026-10-23T12:00:00.000Z', toolName: 'ResearchPadi', toolVersion: '1.0' };
const flat = (s: string) => s.replace(/\s+/g, ' ');

const content = [
  'Mobile money now reaches most adults in Kumasi (Mensah, 2020).',
  'CHAPTER 1',
  '## INTRODUCTION',
  '1.1 Background',
  'Traders with **daily** sales of GH₵ 250 or more → use it most; α = 0.05 and β ≥ 0.8.',
  'Table 4.1: Demographic Characteristics of Respondents',
  '| Variable | Frequency | Percentage (%) |',
  '| --- | --- | --- |',
  '| Male | 60 | 40.0 |',
  ...Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1}. Traders in Adum and Kejetia market were asked how they use mobile money for stock and savings.`),
].join('\n');

test('the study draft PDF carries the same AI labels as the Word file', async () => {
  const pdf = await generateStudyDraftPdf('Mobile Money and Small Businesses in Kumasi', content, provenance);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const text = flat(await extractPdf(pdf));

  // The notice box above the title, then the title.
  const box = text.indexOf('STUDY DRAFT · WRITTEN BY AI');
  assert.ok(box >= 0 && box < text.indexOf('Mobile Money and Small Businesses in Kumasi'), 'notice box is not above the title');
  assert.ok(text.includes(flat(STUDY_DRAFT_NOTICE)), 'notice text is missing');
  assert.match(text, /Draft ID paper-42 · Generated 2026-10-23T12:00:00\.000Z/);

  // The header on every page, and the closing statement at the end.
  const parser = new PDFParse({ data: new Uint8Array(pdf) });
  const { total, info } = await parser.getInfo() as unknown as { total: number; info: Record<string, any> };
  await parser.destroy();
  assert.ok(total > 1, 'expected several pages');
  assert.equal(text.split(STUDY_DRAFT_HEADER).length - 1, total, 'the header is not on every page');
  assert.ok(text.lastIndexOf('About this study draft') > text.indexOf('Paragraph 60.'));
  assert.ok(text.includes(flat(markedLine(provenance))));

  // The file's details, as in the Word file.
  assert.equal(info.Title, 'Mobile Money and Small Businesses in Kumasi');
  assert.equal(info.Subject, STUDY_DRAFT_METADATA.subject);
  assert.equal(info.Custom.description, STUDY_DRAFT_METADATA.description);
  for (const { name, value } of provenanceProperties(provenance)) assert.equal(info.Custom[name], value, name);
});

test('the study draft PDF lays out the text: headings, tables, and characters outside Times', async () => {
  const text = flat(await extractPdf(await generateStudyDraftPdf('Title', content, provenance)));
  // Markdown marks are removed and the pipe table becomes a table.
  assert.doesNotMatch(text, /\*\*|##|\|/);
  assert.match(text, /INTRODUCTION/);
  assert.match(text, /Variable Frequency Percentage \(%\)/);
  // ≥ and Greek letters are kept (set in Roboto); the arrow and cedi sign get plain forms.
  assert.match(text, /GH¢ 250 or more -> use it most; α = 0\.05 and β ≥ 0\.8/);
});

test('text is split into Times runs, with Roboto only for characters Times lacks', () => {
  assert.deepEqual(inline('BP ≥ 140', { bold: true }), [
    { bold: true, text: 'BP ' },
    { bold: true, text: '≥', font: 'Roboto' },
    { bold: true, text: ' 140' },
  ]);
  assert.deepEqual(inline('Café – “ok” …'), [{ text: 'Café – “ok” …' }]);
  assert.deepEqual(inline('Ɔkɔmfo ✓ 😀'), [{ text: 'Okomfo ' }, { text: '√', font: 'Roboto' }, { text: ' ?' }]);
});
