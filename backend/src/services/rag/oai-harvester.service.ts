import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
}

interface HarvestState {
  repoName: string;
  lastResumptionToken: string | null;
  lastPage: number;
  totalRecordsHarvested: number;
  timestamp: string;
}

const RATE_LIMIT_MS = 1000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
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

function getOaiBaseUrl(repo: RepositoryConfig): string {
  const base = repo.oaiBaseUrl.replace(/\/+$/, '');
  if (repo.dspaceVersion === 7) {
    return base.endsWith('/server/oai/request') ? base : `${base}/server/oai/request`;
  }
  return base.endsWith('/oai/request') ? base : `${base}/oai/request`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function harvestMetadata(
  repo: RepositoryConfig,
  from?: string,
  until?: string,
  cursor?: string,
  limit: number = 100
): Promise<OaiHarvestResult> {
  const oaiBaseUrl = getOaiBaseUrl(repo);
  const params: Record<string, string> = {
    verb: 'ListRecords',
    metadataPrefix: 'oai_dc',
  };

  // Don't use set filter — DSpace repos use community-style setSpec values, not simple names
  // if (repo.oaiSet && repo.dspaceVersion === 6) params.set = repo.oaiSet;
  if (from) params.from = from;
  if (until) params.until = until;
  if (cursor) params.resumptionToken = cursor;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(oaiBaseUrl, {
        params: cursor ? { verb: 'ListRecords', resumptionToken: cursor } : params,
        timeout: 30000,
        headers: { 'User-Agent': 'ResearchPadi-Harvester/2.0' },
      });

      const parsed = await parseStringPromise(data);
      
      // DSpace 7+ uses default namespace (no prefix), so keys are 'OAI-PMH', 'ListRecords', etc.
      // DSpace 6 may use 'oai:' prefix, so we check both.
      const pmh = parsed['oai:OAI-PMH'] || parsed['OAI-PMH'];
      const listRecords = pmh?.['oai:ListRecords']?.[0] || pmh?.['ListRecords']?.[0];

      if (!listRecords) {
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
        };
      });

      const tokenEl = listRecords['oai:resumptionToken']?.[0] || listRecords['resumptionToken']?.[0];
      const hasMore = tokenEl?.$.completeListSize
        ? parseInt(tokenEl.$.completeListSize) > records.length
        : !!tokenEl?._;

      return {
        records,
        totalRetrieved: records.length,
        hasMore,
        cursor: tokenEl?._,
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`  Retry ${attempt}/${MAX_RETRIES} for ${repo.name} in ${delay}ms: ${err.message}`);
        await sleep(delay);
      }
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
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
