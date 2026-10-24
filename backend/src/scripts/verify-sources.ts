/**
 * Check every library source, and the embedding key, before relying on them.
 *   npm run rag:verify
 * OAI-PMH repositories and journals get an Identify request (AJOL's are paced, so this
 * takes about two minutes); DSpace 7 sites, which the harvest reads through their REST
 * API, get a one-item query; OpenAlex gets a two-page query (page 2 needs an API key);
 * the embedding provider embeds one word.
 */
import 'dotenv/config';
import { GHANA_REPOSITORIES } from '../services/rag/repositories.js';
import { checkRepository } from '../services/rag/oai-harvester.service.js';
import { DSPACE_REPOSITORIES, listRecentItems } from '../services/rag/dspace.service.js';
import { openAlexGhanaFilter } from '../services/rag/openalex-harvester.service.js';
import { openAlexAuthParams } from '../services/citations/openalex.service.js';
import { describeError, harvestGet } from '../services/rag/harvest-http.js';
import { embeddingProblem, generateEmbeddings } from '../services/rag/embedder.service.js';

const rows: { source: string; status: string }[] = [];
for (const repo of GHANA_REPOSITORIES) {
  const dspace = DSPACE_REPOSITORIES.find((d) => d.sourceName === repo.name);
  if (dspace) {
    try {
      const { totalPages } = await listRecentItems(dspace, 0, 1);
      rows.push({ source: repo.name, status: `OK — ${totalPages} items (REST API)` });
    } catch (err) {
      rows.push({ source: repo.name, status: `FAILED — ${describeError(err)}` });
    }
    continue;
  }
  const check = await checkRepository(repo);
  rows.push({ source: repo.name, status: check.ok ? 'OK' : `UNREACHABLE (skipped by the harvest) — ${check.reason}` });
}

const auth = openAlexAuthParams();
try {
  const params = { filter: openAlexGhanaFilter('2010-01-01'), 'per-page': 1, select: 'id', ...auth };
  const { data } = await harvestGet<any>('https://api.openalex.org/works', { params: { ...params, cursor: '*' } }, { retries: 1 });
  let status = `OK — ${data?.meta?.count ?? '?'} works with abstracts since 2010`;
  if ('api_key' in auth) {
    await harvestGet('https://api.openalex.org/works', { params: { ...params, cursor: data?.meta?.next_cursor } }, { retries: 1 });
    status += '; API key accepted';
  } else {
    status += '; OPENALEX_API_KEY not set (shared daily budget, max 10,000 results per range)';
  }
  rows.push({ source: 'OpenAlex (Ghana)', status });
} catch (err) {
  rows.push({ source: 'OpenAlex (Ghana)', status: `FAILED — ${describeError(err)}` });
}

const [vector] = await generateEmbeddings(['library']);
rows.push({ source: 'Embeddings (OPENAI_API_KEY)', status: vector ? `OK — ${vector.length} dimensions` : `FAILED — ${embeddingProblem() ?? 'no vector returned'}` });

console.table(rows);
process.exit(0);
