import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCitedKeys, citedSources, formatApaReference, buildReferenceList, apaAuthors } from '../references.service.js';
import { STANDARD_METHOD_SOURCES, citationKey, type PaperSource } from '../paper-source.js';

const mensah: PaperSource = { title: 'Mobile money and traders in Kumasi', authors: 'Mensah, Kwame Ama', year: 2021, type: 'article', venue: 'Ghana Journal of Development Studies', volume: '18', issue: '2', pages: '44–61', doi: '10.4314/gjds.v18i2.3' };
const owusu: PaperSource = { title: 'Savings groups in Ashanti', authors: 'Owusu, Ama; Boateng, Eric', year: 2019, type: 'article', venue: 'African Review' };
const boateng: PaperSource = { title: 'Credit access', authors: 'Boateng, Eric; Asante, Yaw; Mensah, Kofi', year: 2020, type: 'article', venue: 'Journal X' };
const ghs: PaperSource = { title: 'Annual report', authors: 'Ghana Health Service', year: 2022, type: 'report', publisher: 'Ghana Health Service' };
const thesis: PaperSource = { title: 'Use of mobile money among market women', authors: 'Adjei, Grace', year: 2018, type: 'thesis', genre: "Master's thesis", institution: 'University of Ghana', repository: 'UGSpace', url: 'https://ugspace.ug.edu.gh/handle/123456789/1234' };
const uncited: PaperSource = { title: 'Never cited', authors: 'Nobody, A.', year: 2015, type: 'article', venue: 'Y' };

test('finds parenthetical, grouped and narrative citations', () => {
  const text = 'Traders save more (Mensah, 2021). Groups matter (Owusu & Boateng, 2019; Boateng et al., 2020a). Adjei (2018) found the same. Data came from (Ghana Health Service, 2022).';
  const keys = extractCitedKeys(text).map((k) => `${k.surname}:${k.year}`);
  assert.deepEqual(keys.sort(), ['adjei:2018', 'boateng:2020', 'mensah:2021', 'owusu:2019', 'service:2022'].sort());
});

test('ignores brackets without a year, and numbers that are not citations', () => {
  assert.deepEqual(extractCitedKeys('The sample (n = 200) was drawn (see Table 4.1). Section 2.3 (2019 data) applies.'), []);
});

test('citedSources keeps only the sources the text cites, once each', () => {
  const text = 'A (Mensah, 2021). B (Mensah, 2021). C (Ghana Health Service, 2022). Adjei (2018).';
  const picked = citedSources(text, [mensah, owusu, ghs, thesis, uncited]);
  assert.deepEqual(picked.map((s) => s.title), [mensah.title, ghs.title, thesis.title]);
});

test('year must match too', () => {
  assert.equal(citedSources('(Mensah, 2019)', [mensah]).length, 0);
});

test('APA author lists', () => {
  assert.equal(apaAuthors('Mensah, Kwame Ama'), 'Mensah, K. A.');
  assert.equal(apaAuthors('Owusu, Ama; Boateng, Eric'), 'Owusu, A., & Boateng, E.');
  assert.equal(apaAuthors('Boateng, Eric; Asante, Yaw; Mensah, Kofi'), 'Boateng, E., Asante, Y., & Mensah, K.');
  assert.equal(apaAuthors('Ghana Health Service'), 'Ghana Health Service');
  assert.equal(apaAuthors('Unknown'), '');
});

test('formats a journal article with volume, issue, pages and DOI', () => {
  assert.equal(
    formatApaReference(mensah),
    'Mensah, K. A. (2021). Mobile money and traders in Kumasi. Ghana Journal of Development Studies, 18(2), 44–61. https://doi.org/10.4314/gjds.v18i2.3',
  );
});

test('formats a thesis with genre, institution and repository', () => {
  assert.equal(
    formatApaReference(thesis),
    "Adjei, G. (2018). Use of mobile money among market women [Master's thesis, University of Ghana]. UGSpace. https://ugspace.ug.edu.gh/handle/123456789/1234",
  );
});

test('formats books with editions and organisation reports', () => {
  assert.equal(
    formatApaReference(STANDARD_METHOD_SOURCES[0]),
    'Creswell, J. W., & Creswell, J. D. (2018). Research design: Qualitative, quantitative, and mixed methods approaches (5th ed.). SAGE Publications.',
  );
  assert.equal(formatApaReference(ghs), 'Ghana Health Service. (2022). Annual report. Ghana Health Service.');
});

test('a source with no authors starts with its title', () => {
  const s: PaperSource = { title: 'National Health Policy', authors: 'Unknown', year: null, type: 'report', publisher: 'Ministry of Health' };
  assert.equal(formatApaReference(s), 'National Health Policy. (n.d.). Ministry of Health.');
});

test('reference list is headed and alphabetical', () => {
  const list = buildReferenceList([owusu, mensah, thesis]);
  const lines = list.split('\n\n');
  assert.equal(lines[0], 'References');
  assert.ok(lines[1].startsWith('Adjei'));
  assert.ok(lines[2].startsWith('Mensah'));
  assert.ok(lines[3].startsWith('Owusu'));
});

test('citation keys follow APA in-text rules', () => {
  assert.equal(citationKey(mensah), '(Mensah, 2021)');
  assert.equal(citationKey(owusu), '(Owusu & Boateng, 2019)');
  assert.equal(citationKey(boateng), '(Boateng et al., 2020)');
});
