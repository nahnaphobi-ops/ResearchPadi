import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openAlexWorkToRows, openAlexGhanaFilter, OPENALEX_GHANA, type OpenAlexHarvestWork } from '../openalex-harvester.service.js';
import { getOaiBaseUrl, isIdentifyResponse } from '../oai-harvester.service.js';
import { GHANA_REPOSITORIES } from '../repositories.js';

const abstractWords = 'This study examined mobile money adoption among market women in Kumasi using a cross-sectional survey of traders in three markets and found that trust and agent proximity shaped regular use'.split(' ');
const work: OpenAlexHarvestWork = {
  id: 'https://openalex.org/W123',
  doi: 'https://doi.org/10.4314/GMJ.V55I2.1',
  display_name: 'Mobile money adoption among market women in Kumasi',
  publication_year: 2021,
  type: 'article',
  language: 'en',
  authorships: [
    { author: { display_name: 'Kwame Mensah' }, institutions: [{ display_name: 'Kwame Nkrumah University of Science and Technology', country_code: 'GH' }] },
    { author: { display_name: 'Ama Owusu' }, institutions: [{ display_name: 'University of Leeds', country_code: 'GB' }] },
  ],
  primary_location: { landing_page_url: 'https://example.org/a', source: { display_name: 'Ghana Medical Journal', host_organization_name: 'Ghana Medical Association' } },
  abstract_inverted_index: Object.fromEntries(abstractWords.map((w, i) => [w, [i]])),
  primary_topic: { field: { display_name: 'Economics' }, subfield: { display_name: 'Development economics' } },
};

test('an OpenAlex work becomes citable knowledge rows', () => {
  const rows = openAlexWorkToRows(work);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.source_name, OPENALEX_GHANA);
  assert.equal(r.source_url, 'https://doi.org/10.4314/gmj.v55i2.1');
  assert.equal(r.doi, '10.4314/gmj.v55i2.1');
  assert.equal(r.authors, 'Mensah, Kwame; Owusu, Ama');
  assert.equal(r.institution, 'Kwame Nkrumah University of Science and Technology');
  assert.equal(r.journal, 'Ghana Medical Journal');
  assert.equal(r.field, 'Development economics');
  assert.ok(r.chunk_text.startsWith('This study examined mobile money'));
});

test('works without a title or a real abstract are skipped', () => {
  assert.deepEqual(openAlexWorkToRows({ ...work, display_name: '' }), []);
  assert.deepEqual(openAlexWorkToRows({ ...work, abstract_inverted_index: { Short: [0] } }), []);
});

test('without a DOI the landing page is the link', () => {
  assert.equal(openAlexWorkToRows({ ...work, doi: null })[0].source_url, 'https://example.org/a');
});

test('the OpenAlex filter restricts to Ghana-based authors with abstracts in the date range', () => {
  const f = openAlexGhanaFilter('2024-01-01', '2024-12-31');
  assert.match(f, /authorships\.institutions\.country_code:GH/);
  assert.match(f, /has_abstract:true/);
  assert.match(f, /from_publication_date:2024-01-01/);
  assert.match(f, /to_publication_date:2024-12-31/);
  assert.doesNotMatch(openAlexGhanaFilter('2024-01-01'), /to_publication_date/);
});

test('OJS journals keep their /oai address; DSpace gets its standard path', () => {
  const gmj = GHANA_REPOSITORIES.find((r) => r.name === 'AJOL_GMJ')!;
  assert.equal(getOaiBaseUrl(gmj), 'https://www.ajol.info/index.php/gmj/oai');
  assert.equal(getOaiBaseUrl({ ...gmj, platform: 'dspace', dspaceVersion: 6, oaiBaseUrl: 'https://ir.uew.edu.gh' }), 'https://ir.uew.edu.gh/oai/request');
  assert.equal(getOaiBaseUrl({ ...gmj, platform: undefined, dspaceVersion: 7, oaiBaseUrl: 'https://ir.ucc.edu.gh/' }), 'https://ir.ucc.edu.gh/server/oai/request');
});

test('Identify responses are recognised, error pages are not', () => {
  assert.ok(isIdentifyResponse('<?xml version="1.0"?><OAI-PMH><Identify><repositoryName>Ghana Medical Journal</repositoryName></Identify></OAI-PMH>'));
  assert.ok(isIdentifyResponse('<oai:OAI-PMH><oai:Identify><oai:repositoryName>X</oai:repositoryName></oai:Identify></oai:OAI-PMH>'));
  assert.ok(!isIdentifyResponse('<html><body>404 Not Found</body></html>'));
  assert.ok(!isIdentifyResponse('<OAI-PMH><error code="badVerb">Illegal verb</error></OAI-PMH>'));
});

test('repository names are unique', () => {
  const names = GHANA_REPOSITORIES.map((r) => r.name);
  assert.equal(new Set(names).size, names.length);
});
