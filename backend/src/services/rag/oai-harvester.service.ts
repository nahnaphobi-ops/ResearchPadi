import { parseStringPromise } from 'xml2js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { FirewallChallengeError, describeError, harvestGet, type HarvestGetOptions } from './harvest-http.js';

export interface OaiRecord {
  identifier: string;
  title: string;
  creators: string[];
  date: string;
  description: string;
  subject: string[];
  type: string;
  language: string;
  rights: string;
  source: string;
  /** dc:identifier values — usually the handle URL, sometimes a DOI or ISBN. */
  links: string[];
}

export interface OaiHarvestResult {
  records: OaiRecord[];
  totalRetrieved: number;
  hasMore: boolean;
  cursor?: string;
}

export interface RepositoryConfig {
  name: string;
  oaiBaseUrl: string;
  oaiSet: string;
  institution: string;
  institutionType: 'university' | 'nmtc' | 'technical_university' | 'college_of_education';
  dspaceVersion: 6 | 7;
  /** OJS journals (e.g. on AJOL) use their /oai URL as given. Default 'dspace'. */
  platform?: 'dspace' | 'ojs';
  /** Minimum gap between requests to this host (default 1 s); AJOL's firewall challenges faster clients. */
  requestIntervalMs?: number;
}

interface HarvestState {
  repoName: string;
  lastResumptionToken: string | null;
  lastPage: number;
  totalRecordsHarvested: number;
  timestamp: string;
}

const RATE_LIMIT_MS = 1000;
const SAFETY_MAX_PAGES = 200;
const STATE_DIR = join(process.env.TEMP || '/tmp', 'researchpadi-harvest');

function getStatePath(repoName: string): string {
  return join(STATE_DIR, `${repoName.replace(/\s+/g, '_')}.state.json`);
}

function saveState(state: HarvestState): void {
  try {
    writeFileSync(getStatePath(state.repoName), JSON.stringify(state, null, 2));
  } catch { /* best effort */ }
}

function loadState(repoName: string): HarvestState | null {
  const path = getStatePath(repoName);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function getOaiBaseUrl(repo: RepositoryConfig): string {
  const base = repo.oaiBaseUrl.replace(/\/+$/, '');
  if (repo.platform === 'ojs') return base;
  if (repo.dspaceVersion === 7) {
    return base.endsWith('/server/oai/request') ? base : `${base}/server/oai/request`;
  }
  return base.endsWith('/oai/request') ? base : `${base}/oai/request`;
}

function requestOptions(repo: RepositoryConfig): HarvestGetOptions {
  return { minIntervalMs: repo.requestIntervalMs ?? RATE_LIMIT_MS };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** The endpoint answered, but not with usable OAI-PMH (empty body, HTML page, OAI error). */
export class OaiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OaiResponseError';
  }
}

/** Parse an OAI-PMH response to its root element. "No records" is a normal, empty answer. */
export async function parseOai(xml: unknown): Promise<any> {
  const text = typeof xml === 'string' ? xml : '';
  if (!text.trim()) throw new OaiResponseError('Empty response instead of OAI-PMH XML');
  let parsed: any;
  try {
    parsed = await parseStringPromise(text);
  } catch (err) {
    throw new OaiResponseError(`Response is not XML: ${(err as Error).message.split('\n')[0]}`);
  }
  // DSpace 7+ uses default namespace (no prefix), so keys are 'OAI-PMH', 'ListRecords', etc.
  // DSpace 6 may use 'oai:' prefix, so we check both.
  const pmh = parsed?.['oai:OAI-PMH'] ?? parsed?.['OAI-PMH'];
  if (!pmh || typeof pmh !== 'object') throw new OaiResponseError('Response is not OAI-PMH (an error or login page?)');
  const error = (pmh['oai:error'] ?? pmh['error'])?.[0];
  if (error) {
    const code = error?.$?.code ?? 'unknown';
    if (code !== 'noRecordsMatch' && code !== 'noSetHierarchy') {
      const detail = (typeof error === 'string' ? error : error?._ ?? '').trim();
      throw new OaiResponseError(`OAI-PMH error ${code}${detail ? `: ${detail}` : ''}`);
    }
  }
  return pmh;
}

/** xml2js gives a bare string for <resumptionToken>abc</resumptionToken> and an object when it has attributes. */
function tokenText(el: unknown): string | undefined {
  const text = typeof el === 'string' ? el : (el as { _?: unknown } | undefined)?._;
  return typeof text === 'string' && text.trim() ? text.trim() : undefined;
}

/** Records and the resumption token from a parsed ListRecords response. */
export function readListRecords(pmh: any): OaiHarvestResult {
  const listRecords = pmh?.['oai:ListRecords']?.[0] ?? pmh?.['ListRecords']?.[0];
  if (!listRecords || typeof listRecords !== 'object') {
    return { records: [], totalRetrieved: 0, hasMore: false };
  }

  const rawRecords = listRecords['oai:record'] || listRecords['record'] || [];
  const records: OaiRecord[] = rawRecords.map((rec: any) => {
    const recMeta = rec['oai:metadata']?.[0] || rec['metadata']?.[0] || {};
    // Dublin Core metadata may be under oai_dc:dc, dc:dc, or just dc
    const dcMeta = recMeta['oai_dc:dc']?.[0] || recMeta['dc:dc']?.[0] || recMeta['dc']?.[0] || {};
    const header = rec['oai:header']?.[0] || rec['header']?.[0] || rec['header'] || {};
    // With explicitArray:false, identifier may be at header.identifier or header.$.identifier
    const identifier = extractText(header?.$?.identifier) || extractText(header?.identifier) || '';
    return {
      identifier,
      title: extractText(dcMeta['dc:title']),
      creators: extractArray(dcMeta['dc:creator']),
      date: extractText(dcMeta['dc:date']),
      description: extractText(dcMeta['dc:description']),
      subject: extractArray(dcMeta['dc:subject']),
      type: extractText(dcMeta['dc:type']),
      language: extractText(dcMeta['dc:language']),
      rights: extractText(dcMeta['dc:rights']),
      source: extractText(dcMeta['dc:source']),
      links: extractArray(dcMeta['dc:identifier']),
    };
  });

  // The last page carries an empty token (often with attributes), so only real text means "more".
  const cursor = tokenText(listRecords['oai:resumptionToken']?.[0] ?? listRecords['resumptionToken']?.[0]);
  return { records, totalRetrieved: records.length, hasMore: !!cursor, cursor };
}

export async function harvestMetadata(
  repo: RepositoryConfig,
  from?: string,
  until?: string,
  cursor?: string,
  limit: number = 100,
  set?: string
): Promise<OaiHarvestResult> {
  const params: Record<string, string> = {
    verb: 'ListRecords',
    metadataPrefix: 'oai_dc',
  };

  // Some repositories (e.g. UEW) only answer ListRecords per set; callers pass a setSpec from listSets().
  if (set) params.set = set;
  if (from) params.from = from;
  if (until) params.until = until;

  // Retries, pacing and firewall back-off happen in harvestGet.
  const { data } = await harvestGet<string>(getOaiBaseUrl(repo), {
    params: cursor ? { verb: 'ListRecords', resumptionToken: cursor } : params,
    responseType: 'text',
  }, requestOptions(repo));
  return readListRecords(await parseOai(data));
}

export async function harvestAll(
  repo: RepositoryConfig,
  from?: string,
  until?: string,
  onBatch?: (records: OaiRecord[]) => Promise<void>,
  resume: boolean = true
): Promise<OaiRecord[]> {
  const allRecords: OaiRecord[] = [];
  let startToken: string | undefined;
  let startPage = 0;
  let startTotal = 0;

  if (resume) {
    const state = loadState(repo.name);
    if (state?.lastResumptionToken) {
      startToken = state.lastResumptionToken;
      startPage = state.lastPage;
      startTotal = state.totalRecordsHarvested;
      console.log(`  Resuming ${repo.name} from page ${startPage} (${startTotal} records harvested)`);
    }
  }

  let cursor: string | undefined = startToken;
  let page = startPage;
  let totalRecords = startTotal;

  do {
    page++;
    const result = await harvestMetadata(repo, from, until, cursor);
    allRecords.push(...result.records);
    totalRecords += result.records.length;

    if (onBatch) {
      await onBatch(result.records);
    }

    saveState({
      repoName: repo.name,
      lastResumptionToken: result.hasMore ? (result.cursor || null) : null,
      lastPage: page,
      totalRecordsHarvested: totalRecords,
      timestamp: new Date().toISOString(),
    });

    cursor = result.hasMore ? result.cursor : undefined;

    if (page >= SAFETY_MAX_PAGES) {
      console.warn(`  Safety limit reached at ${SAFETY_MAX_PAGES} pages for ${repo.name}`);
      break;
    }

    if (result.records.length > 0) {
      console.log(`  [${repo.name}] Batch ${page}: ${result.records.length} records (total: ${totalRecords})`);
    }

    await sleep(RATE_LIMIT_MS);
  } while (cursor);

  saveState({
    repoName: repo.name,
    lastResumptionToken: null,
    lastPage: page,
    totalRecordsHarvested: totalRecords,
    timestamp: new Date().toISOString(),
  });

  return allRecords;
}

export function clearResumeState(repoName: string): void {
  const path = getStatePath(repoName);
  if (existsSync(path)) {
    try { require('fs').unlinkSync(path); } catch { /* best effort */ }
  }
}

function extractText(field: any): string {
  if (!field) return '';
  if (Array.isArray(field)) {
    // Join all text elements — dc:description often has multiple values
    return field.map(f => f?._ || f || '').filter(Boolean).join(' ');
  }
  return String(field);
}

function extractArray(field: any): string[] {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.map((f: any) => f?._ || f || '').filter(Boolean);
  }
  return [String(field)];
}

/** True when the endpoint answers an OAI-PMH Identify request. */
export function isIdentifyResponse(xml: string): boolean {
  return /<(?:oai:)?Identify\b/.test(xml) && /<(?:oai:)?repositoryName\b/.test(xml);
}

export type RepositoryCheck = { ok: true } | { ok: false; reason: string; blocked: boolean };

/** Check a repository answers Identify; says why when it doesn't (blocked = its firewall challenged us). */
export async function checkRepository(repo: RepositoryConfig): Promise<RepositoryCheck> {
  try {
    const { data } = await harvestGet<string>(getOaiBaseUrl(repo), {
      params: { verb: 'Identify' },
      timeout: 30_000,
      responseType: 'text',
    }, { ...requestOptions(repo), retries: 1 });
    return isIdentifyResponse(String(data)) ? { ok: true } : { ok: false, reason: 'the Identify response was not OAI-PMH', blocked: false };
  } catch (err) {
    return { ok: false, reason: describeError(err), blocked: err instanceof FirewallChallengeError };
  }
}

/** Check a repository is up before harvesting it; unreachable ones are skipped and logged. */
export async function identifyRepository(repo: RepositoryConfig): Promise<boolean> {
  return (await checkRepository(repo)).ok;
}

/** All setSpecs a repository exposes (following resumption tokens). */
export async function listSets(repo: RepositoryConfig): Promise<string[]> {
  const specs: string[] = [];
  let token: string | undefined;
  for (let page = 0; page < 20; page++) {
    const { data } = await harvestGet<string>(getOaiBaseUrl(repo), {
      params: token ? { verb: 'ListSets', resumptionToken: token } : { verb: 'ListSets' },
      responseType: 'text',
    }, requestOptions(repo));
    const pmh = await parseOai(data);
    const list = pmh['oai:ListSets']?.[0] ?? pmh['ListSets']?.[0];
    if (!list || typeof list !== 'object') break;
    for (const set of list['oai:set'] || list['set'] || []) {
      const spec = extractText(set['oai:setSpec'] || set['setSpec']);
      if (spec) specs.push(spec);
    }
    token = tokenText(list['oai:resumptionToken']?.[0] ?? list['resumptionToken']?.[0]);
    if (!token) break;
  }
  return specs;
}
