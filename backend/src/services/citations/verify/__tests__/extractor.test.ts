import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCitations } from '../extractor.service';

// Reference-list block (APA style used by ResearchPadi).
const REF_BLOCK = `
References

1. Mensah, K., & Owusu, J. (2021). Maternal health outcomes in Ghana: A longitudinal study. Ghana Medical Journal, 55(2), 112-120.
2. Boateng, A. (2019). Rural education policy in West Africa. Journal of Education, 12(3), 45-60. https://doi.org/10.1234/je.2019.0045
3. Smith, J. (2020). Global climate change. Oxford University Press.
`;

const BODY = `Mensah and Owusu (2021) found strong effects. (Boateng, 2019) also noted policy gaps. A separate claim (Smith, 2020) is cited.`;

test('extracts in-text parenthetical and narrative citations', async () => {
  const { inText } = await extractCitations(BODY, REF_BLOCK);
  // Boateng (2019) -> parenthetical; Mensah and Owusu (2021) -> narrative; Smith (2020) -> parenthetical
  assert.ok(inText.length >= 3, `expected >=3 in-text, got ${inText.length}`);
  const smith = inText.find(c => c.authors.some(a => a.surname === 'Smith'));
  assert.ok(smith, 'Smith in-text should be extracted');
  assert.equal(smith?.year, 2020);
});

test('parses reference entries into structured fields', async () => {
  const { references } = await extractCitations(BODY, REF_BLOCK);
  assert.equal(references.length, 3);
  const mensah = references.find(r => r.authors.some(a => a.surname === 'Mensah'));
  assert.ok(mensah, 'Mensah reference parsed');
  assert.equal(mensah?.year, 2021);
  assert.match(mensah?.title || '', /Maternal health outcomes in Ghana/i);
  // DOI extracted from Boateng entry
  const boateng = references.find(r => r.authors.some(a => a.surname === 'Boateng'));
  assert.match(boateng?.doi || '', /^10\./);
});

test('marks extraction method for parsed entries as regex', async () => {
  const { references } = await extractCitations(BODY, REF_BLOCK);
  assert.ok(references.every(r => r.extraction_method === 'regex' || r.extraction_method === 'llm_assisted'));
});
