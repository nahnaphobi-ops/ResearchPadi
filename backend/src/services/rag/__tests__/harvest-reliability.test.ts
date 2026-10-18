import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError, type AxiosResponse } from 'axios';
import { FirewallChallengeError, describeError, harvestGet } from '../harvest-http.js';
import { OaiResponseError, parseOai, readListRecords } from '../oai-harvester.service.js';
import {
  databaseLimitMb, embeddingNote, harvestSets, joinNotes, parseResume, skippedSetsNote, storageLimitMessage, StorageLimitError,
} from '../harvest-policy.js';
import { openAlexStart } from '../openalex-harvester.service.js';
import { openAlexAuthParams } from '../../citations/openalex.service.js';
import { GHANA_REPOSITORIES } from '../repositories.js';

const ok = (data: unknown, status = 200, headers: Record<string, string> = {}) => ({ status, headers, data, statusText: '', config: {} }) as unknown as AxiosResponse;

function httpError(status: number, url: string, data: unknown = '', headers: Record<string, string> = {}) {
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', { url, headers: {} } as any, undefined, ok(data, status, headers));
}

/** Fake transport: answers (or throws) each call in turn; records the waits. */
function fake(...answers: (AxiosResponse | Error)[]) {
  const sleeps: number[] = [];
  let calls = 0;
  const opts = {
    minIntervalMs: 0,
    baseDelayMs: 10,
    challengeDelayMs: 100,
    sleep: async (ms: number) => { sleeps.push(ms); },
    request: async () => {
      const a = answers[Math.min(calls++, answers.length - 1)];
      if (a instanceof Error) throw a;
      return a;
    },
  };
  return { opts, sleeps, calls: () => calls };
}

test('a dropped connection ("socket hang up") is retried', async () => {
  const f = fake(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }), ok('<OAI-PMH/>'));
  const res = await harvestGet('https://ir.knust.edu.gh/x', {}, f.opts);
  assert.equal(res.data, '<OAI-PMH/>');
  assert.equal(f.calls(), 2);
  assert.deepEqual(f.sleeps, [10]);
});

test("AJOL's firewall challenge (HTTP 202, empty body) backs off, then gives up with a clear error", async () => {
  const challenge = ok('', 202, { 'x-amzn-waf-action': 'challenge' });
  const f = fake(challenge);
  await assert.rejects(harvestGet('https://www.ajol.info/index.php/gmj/oai', {}, { ...f.opts, retries: 2 }), (err: unknown) => {
    assert.ok(err instanceof FirewallChallengeError);
    assert.equal(err.host, 'www.ajol.info');
    return true;
  });
  assert.deepEqual(f.sleeps, [100, 200]);
});

test('a challenge that clears lets the harvest carry on', async () => {
  const f = fake(ok('', 202, { 'x-amzn-waf-action': 'challenge' }), ok('<OAI-PMH/>'));
  assert.equal((await harvestGet('https://www.ajol.info/index.php/gjg/oai', {}, f.opts)).data, '<OAI-PMH/>');
});

test('an empty 200 body is retried rather than parsed', async () => {
  const f = fake(ok(''), ok('<OAI-PMH/>'));
  assert.equal((await harvestGet('https://ir.ucc.edu.gh/x', {}, f.opts)).data, '<OAI-PMH/>');
  assert.equal(f.calls(), 2);
});

test('client errors are not retried', async () => {
  const f = fake(httpError(404, 'https://ir.uew.edu.gh/oai/request'));
  await assert.rejects(harvestGet('https://ir.uew.edu.gh/oai/request', {}, f.opts), /404/);
  assert.equal(f.calls(), 1);
});

test('HTTP 500 is retried; 429 waits for Retry-After unless that is hours away', async () => {
  const f500 = fake(httpError(500, 'https://ir.uew.edu.gh/oai/request'), ok('<OAI-PMH/>'));
  await harvestGet('https://ir.uew.edu.gh/oai/request', {}, f500.opts);
  assert.equal(f500.calls(), 2);

  const f429 = fake(httpError(429, 'https://api.openalex.org/works', {}, { 'retry-after': '2' }), ok({ results: [] }));
  await harvestGet('https://api.openalex.org/works', {}, f429.opts);
  assert.deepEqual(f429.sleeps, [2000]);

  const budget = fake(httpError(429, 'https://api.openalex.org/works', {}, { 'retry-after': '45847' }));
  await assert.rejects(harvestGet('https://api.openalex.org/works', {}, budget.opts), /429/);
  assert.equal(budget.calls(), 1);
});

test("harvest_logs get the server's explanation, not just the status line", () => {
  const err = httpError(401, 'https://api.openalex.org/works', { error: 'API key required for cursor paging', message: 'Paging past the first page with cursor= needs a free API key.' });
  assert.equal(describeError(err), 'HTTP 401 from api.openalex.org: Paging past the first page with cursor= needs a free API key.');
  assert.equal(describeError(httpError(500, 'https://ir.uew.edu.gh/oai/request', '<!doctype html><title>HTTP Status 500</title>')), 'HTTP 500 from ir.uew.edu.gh');
  assert.equal(describeError(new Error('socket hang up')), 'socket hang up');
});

test('an empty or non-OAI response is a clear error, not a null read', async () => {
  await assert.rejects(parseOai(''), (err: unknown) => err instanceof OaiResponseError && /Empty response/.test(err.message));
  await assert.rejects(parseOai(null), OaiResponseError);
  await assert.rejects(parseOai('<html><body>Challenge</body></html>'), /not OAI-PMH/);
  await assert.rejects(parseOai('<OAI-PMH><error code="badResumptionToken">expired</error></OAI-PMH>'), /badResumptionToken: expired/);
});

test('"no records" is an empty page', async () => {
  const pmh = await parseOai('<OAI-PMH><error code="noRecordsMatch">No matching records</error></OAI-PMH>');
  assert.deepEqual(readListRecords(pmh), { records: [], totalRetrieved: 0, hasMore: false });
});

const page = (token: string) => `<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"><ListRecords>
  <record><header><identifier>oai:ajol:1</identifier></header><metadata>
    <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title>Malaria in Tamale</dc:title><dc:identifier>https://www.ajol.info/index.php/gmj/article/view/1</dc:identifier>
    </oai_dc:dc></metadata></record>
  ${token}</ListRecords></OAI-PMH>`;

test('a resumption token without attributes is followed (it used to crash)', async () => {
  const result = readListRecords(await parseOai(page('<resumptionToken>abc123</resumptionToken>')));
  assert.equal(result.records[0].title, 'Malaria in Tamale');
  assert.equal(result.cursor, 'abc123');
  assert.equal(result.hasMore, true);
});

test('the empty token on the last page ends the list', async () => {
  const result = readListRecords(await parseOai(page('<resumptionToken completeListSize="862" cursor="860"/>')));
  assert.equal(result.records.length, 1);
  assert.equal(result.hasMore, false);
  assert.equal(result.cursor, undefined);
});

test('a collection that keeps failing is skipped and reported; the others are harvested', async () => {
  const ran: string[] = [];
  const result = await harvestSets(['col_1', 'col_739', 'col_2'], async (set) => {
    ran.push(set);
    if (set === 'col_739') throw httpError(500, 'https://ir.uew.edu.gh/oai/request');
    return true;
  });
  assert.deepEqual(ran, ['col_1', 'col_739', 'col_2']);
  assert.equal(result.exhausted, false);
  assert.deepEqual(result.failed, ['col_739 (HTTP 500 from ir.uew.edu.gh)']);
  assert.match(skippedSetsNote(result.failed)!, /Skipped 1 collection/);
  assert.equal(skippedSetsNote([]), null);
});

test('a firewall challenge or the size limit still stops the collections', async () => {
  const ran: string[] = [];
  await assert.rejects(harvestSets(['a', 'b', 'c'], async (set) => {
    ran.push(set);
    if (set === 'b') throw new FirewallChallengeError('www.ajol.info');
    return true;
  }), FirewallChallengeError);
  assert.deepEqual(ran, ['a', 'b']);
  await assert.rejects(harvestSets(['a'], async () => { throw new StorageLimitError('full'); }), StorageLimitError);
  assert.deepEqual(await harvestSets(['a', 'b'], async () => false), { exhausted: false, failed: [] });
});

test('the database size limit defaults below Supabase Free and can be raised or turned off', () => {
  assert.equal(databaseLimitMb({}), 400);
  assert.equal(databaseLimitMb({ HARVEST_DB_LIMIT_MB: '7000' }), 7000);
  assert.equal(databaseLimitMb({ HARVEST_DB_LIMIT_MB: 'lots' }), 400);
  assert.equal(databaseLimitMb({ HARVEST_DB_LIMIT_MB: '0' }), 0);
  assert.equal(storageLimitMessage(399, 400), null);
  assert.match(storageLimitMessage(412, 400)!, /database is 412 MB, at or over HARVEST_DB_LIMIT_MB=400/);
  assert.match(storageLimitMessage(412, 400, true)!, /about 412 MB/);
  assert.equal(storageLimitMessage(9000, 0), null);
});

test('chunks saved without vectors are reported with the reason', () => {
  assert.equal(embeddingNote(0, 'HTTP 401 from openrouter.ai'), null);
  const note = embeddingNote(12, 'HTTP 401 from openrouter.ai: User not found');
  assert.match(note!, /12 chunk\(s\) saved without vectors \(HTTP 401 from openrouter\.ai: User not found\)/);
  assert.match(note!, /embed-knowledge/);
  assert.equal(joinNotes(null, 'a', undefined, 'b'), 'a | b');
  assert.equal(joinNotes(null), undefined);
});

test('a saved OpenAlex position survives notes after it', () => {
  assert.equal(parseResume(`resume:IlsxMDAuMCJd== | ${embeddingNote(3, 'x')}`), 'IlsxMDAuMCJd==');
  assert.equal(parseResume('resume:page:7'), 'page:7');
  assert.equal(parseResume('Stopped: the database is 412 MB'), undefined);
  assert.equal(parseResume(null), undefined);
});

test('OpenAlex pages by cursor with a key and by number without one', () => {
  assert.deepEqual(openAlexStart(undefined, true), { cursor: '*' });
  assert.deepEqual(openAlexStart('IlsxMDAuMCJd', true), { cursor: 'IlsxMDAuMCJd' });
  assert.deepEqual(openAlexStart('page:7', true), { cursor: '*' });
  assert.deepEqual(openAlexStart(undefined, false), { page: 1 });
  assert.deepEqual(openAlexStart('page:7', false), { page: 7 });
  assert.deepEqual(openAlexStart('IlsxMDAuMCJd', false), { page: 1 });
});

test('OPENALEX_API_KEY is sent when set', () => {
  const saved = process.env.OPENALEX_API_KEY;
  try {
    delete process.env.OPENALEX_API_KEY;
    assert.equal('api_key' in openAlexAuthParams(), false);
    process.env.OPENALEX_API_KEY = ' test-key ';
    assert.equal(openAlexAuthParams().api_key, 'test-key');
    assert.ok(openAlexAuthParams().mailto);
  } finally {
    if (saved === undefined) delete process.env.OPENALEX_API_KEY;
    else process.env.OPENALEX_API_KEY = saved;
  }
});

test('AJOL journals are paced to stay under the firewall', () => {
  const ajol = GHANA_REPOSITORIES.filter((r) => r.oaiBaseUrl.includes('ajol.info'));
  assert.ok(ajol.length > 0);
  for (const r of ajol) assert.ok((r.requestIntervalMs ?? 0) >= 15_000, r.name);
});
