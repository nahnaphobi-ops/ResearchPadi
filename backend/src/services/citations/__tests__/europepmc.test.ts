import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSource } from '../europepmc.service.js';
import { withReserved } from '../sources.service.js';
import type { Source, SourceOrigin } from '../source.types.js';

// The shape Europe PMC returns for a PubMed record (resultType=core).
const RECORD = {
  id: '42277159',
  pmid: '42277159',
  doi: '10.1038/S41598-026-57785-8',
  title: 'Risk factors associated with <i>gestational</i> diabetes mellitus in Ghana: a prospective cohort study.',
  authorString: 'Ansah JE, Apaak D, Mensah K.',
  authorList: { author: [{ fullName: 'Ansah JE' }, { fullName: 'Apaak D' }, { fullName: 'Mensah K' }] },
  journalInfo: { volume: '16', issue: '1', journal: { title: 'Scientific reports' } },
  pageInfo: '26728',
  pubYear: '2026',
  abstractText: '<h4>Background</h4> Gestational diabetes &amp; its risk factors were studied in 400 women.',
  affiliation: 'Department of Midwifery, University of Cape Coast, Cape Coast, Ghana.',
  isOpenAccess: 'Y',
  citedByCount: 3,
};

test('a PubMed record becomes a citable source', () => {
  const s = toSource(RECORD)!;
  assert.equal(s.id, 'doi:10.1038/s41598-026-57785-8');
  assert.equal(s.title, 'Risk factors associated with gestational diabetes mellitus in Ghana: a prospective cohort study');
  assert.deepEqual(s.authors.map((a) => a.family), ['Ansah', 'Apaak', 'Mensah']);
  assert.equal(s.year, 2026);
  assert.equal(s.containerTitle, 'Scientific reports');
  assert.equal(s.volume, '16');
  assert.equal(s.issue, '1');
  assert.equal(s.pages, '26728');
  assert.equal(s.url, 'https://doi.org/10.1038/s41598-026-57785-8');
  assert.equal(s.origin, 'europe-pmc');
  assert.equal(s.type, 'article');
  assert.equal(s.openAccess, true);
});

test('abstract text loses its markup, and Ghana-based authors are flagged', () => {
  const s = toSource(RECORD)!;
  assert.equal(s.snippet, 'Background Gestational diabetes & its risk factors were studied in 400 women.');
  assert.equal(s.ghanaian, true);
  assert.equal(toSource({ ...RECORD, affiliation: 'University of Oslo, Norway.' })!.ghanaian, false);
});

test('a record without a DOI is linked through its PubMed id; one without a title is dropped', () => {
  const s = toSource({ ...RECORD, doi: undefined })!;
  assert.equal(s.id, 'pmid:42277159');
  assert.equal(s.url, 'https://europepmc.org/article/MED/42277159');
  assert.equal(toSource({ ...RECORD, title: '  ' }), null);
});

test('authors fall back to the author string, and page ranges use an en dash', () => {
  const s = toSource({ ...RECORD, authorList: undefined, pageInfo: '101-109' })!;
  assert.deepEqual(s.authors.map((a) => a.family), ['Ansah', 'Apaak', 'Mensah']);
  assert.equal(s.pages, '101–109');
});

const src = (origin: SourceOrigin, n: number, ghanaian = false): Source => ({
  id: `${origin}:${n}${ghanaian ? ':gh' : ''}`, title: `${origin} ${n}`, authors: [], year: 2020, type: 'article', origin, ghanaian,
});
const names = (list: Source[]) => list.map((s) => s.id);

test('reserved origins are kept in the results, in ranking order, at the cost of lower-ranked others', () => {
  const ranked = [src('ghana-repository', 1), src('ghana-repository', 2), src('openalex', 1), src('ghana-repository', 3), src('europe-pmc', 1), src('europe-pmc', 2), src('openalex', 2)];
  assert.deepEqual(names(withReserved(ranked, 4)), ['ghana-repository:1', 'ghana-repository:2', 'openalex:1', 'ghana-repository:3']);
  assert.deepEqual(names(withReserved(ranked, 4, { 'europe-pmc': 2 })), ['ghana-repository:1', 'ghana-repository:2', 'europe-pmc:1', 'europe-pmc:2']);
  assert.deepEqual(names(withReserved(ranked, 4, { 'europe-pmc': 1 })), ['ghana-repository:1', 'ghana-repository:2', 'openalex:1', 'europe-pmc:1']);
});

test('a reserve already met, or larger than what was found, changes nothing it cannot', () => {
  const ranked = [src('europe-pmc', 1), src('openalex', 1), src('ghana-repository', 1), src('europe-pmc', 2)];
  assert.deepEqual(names(withReserved(ranked, 3, { 'europe-pmc': 1 })), names(ranked.slice(0, 3)));
  assert.equal(withReserved(ranked, 3, { 'europe-pmc': 10 }).filter((s) => s.origin === 'europe-pmc').length, 2);
  assert.equal(withReserved(ranked, 3, { 'europe-pmc': 10 }).length, 3);
});

test('Ghanaian sources are never dropped to make room for a reserve, and Ghanaian ones are added first', () => {
  const ranked = [
    src('ghana-repository', 1, true), src('openalex', 1, true), src('openalex', 2), src('ghana-repository', 2, true),
    src('europe-pmc', 1), src('europe-pmc', 2, true), src('europe-pmc', 3, true),
  ];
  // Two places are needed: the non-Ghanaian OpenAlex work is dropped, the Ghanaian ones stay.
  const result = withReserved(ranked, 4, { 'europe-pmc': 2 });
  assert.deepEqual(names(result), ['ghana-repository:1:gh', 'openalex:1:gh', 'ghana-repository:2:gh', 'europe-pmc:2:gh']);
  // When only Ghanaian sources are left to drop, the reserve gives way instead.
  const allGhana = [src('ghana-repository', 1, true), src('ghana-repository', 2, true), src('europe-pmc', 1)];
  assert.deepEqual(names(withReserved(allGhana, 2, { 'europe-pmc': 1 })), ['ghana-repository:1:gh', 'ghana-repository:2:gh']);
});
