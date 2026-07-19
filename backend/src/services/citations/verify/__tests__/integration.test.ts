import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyReference } from '../verifier.service.js';
import { crossConsistencyCheck } from '../cross-check.service.js';
import { parseAuthor } from '../extractor.service.js';
import type { ReferenceEntry, InTextCitation, Candidate } from '../types.js';

function makeRef(over: Partial<ReferenceEntry> & { id: string }): ReferenceEntry {
  return {
    authors: [parseAuthor('Mensah, K.')],
    year: 2021,
    title: 'Maternal health outcomes in Ghana',
    raw_string: over.raw_string || 'Mensah, K. (2021). Maternal health outcomes in Ghana.',
    source_location: 'reference_list',
    extraction_method: 'regex',
    ...over,
  };
}

// Deterministic candidate provider returning a single "real" record.
const realCandidates: Candidate[] = [
  {
    id: 'real-1',
    title: 'Maternal health outcomes in Ghana',
    authors: ['K. Mensah'],
    year: 2021,
    source: 'openalex',
  },
];

test('integration: correctly classifies all four citation cases', async () => {
  // 1. CORRECT citation -> verified
  const correct = makeRef({ id: 'r1' });
  const r1 = await verifyReference(correct, { candidateProvider: async () => realCandidates });
  assert.equal(r1.match_status, 'verified');
  assert.equal(r1.matched_source, 'openalex');

  // 2. FABRICATED citation (no matching real source) -> unverified
  const fabricated = makeRef({
    id: 'r2',
    title: 'Quantum teleportation in Kumasi markets',
    authors: [parseAuthor('Alien, X.')],
    year: 2099,
  });
  const r2 = await verifyReference(fabricated, { candidateProvider: async () => realCandidates });
  assert.equal(r2.match_status, 'unverified');

  // 3. CORRECT citation with WRONG YEAR -> partial_match
  const wrongYear = makeRef({ id: 'r3', year: 2015 });
  const r3 = await verifyReference(wrongYear, { candidateProvider: async () => realCandidates });
  assert.equal(r3.match_status, 'partial_match');

  // 4. ORPHAN in-text citation -> flagged by cross-consistency
  const inText: InTextCitation[] = [
    {
      id: 'it1',
      authors: [parseAuthor('Ghost, G.')],
      year: 2000,
      raw_string: '(Ghost, 2000)',
      source_location: 'in_text',
      extraction_method: 'regex',
    },
  ];
  const refs: ReferenceEntry[] = [correct];
  const cross = crossConsistencyCheck(inText, refs, 1);
  assert.deepEqual(cross.orphan_in_text, ['(Ghost, 2000)']);
  // 'correct' reference is never cited in-text here -> flagged as unused.
  assert.equal(cross.unused_references.length, 1);
});

test('integration: unused reference is flagged', async () => {
  const inText: InTextCitation[] = [];
  const refs: ReferenceEntry[] = [makeRef({ id: 'r1' })];
  const cross = crossConsistencyCheck(inText, refs, 1);
  assert.equal(cross.unused_references.length, 1);
  assert.equal(cross.orphan_in_text.length, 0);
});

test('integration: API down still runs RAG-local + cross-consistency (no hard fail)', async () => {
  // Simulate both external APIs + RAG returning nothing (all down).
  const fabricated = makeRef({ id: 'r_down', title: 'Nonexistent study 12345', authors: [parseAuthor('Nobody, N.')], year: 1990 });
  const r = await verifyReference(fabricated, { candidateProvider: async () => [] });
  // Must not throw; result is unverified and job can continue.
  assert.equal(r.match_status, 'unverified');
  assert.equal(r.matched_source, 'none');
});
