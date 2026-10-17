/**
 * Check every library source answers before relying on it.
 *   npm run rag:verify
 * OAI-PMH repositories and journals get an Identify request; OpenAlex gets a
 * one-result query for works by Ghana-based authors.
 */
import 'dotenv/config';
import axios from 'axios';
import { GHANA_REPOSITORIES } from '../services/rag/repositories.js';
import { identifyRepository } from '../services/rag/oai-harvester.service.js';
import { openAlexGhanaFilter } from '../services/rag/openalex-harvester.service.js';

const rows: { source: string; status: string }[] = [];
for (const repo of GHANA_REPOSITORIES) {
  rows.push({ source: repo.name, status: (await identifyRepository(repo)) ? 'OK' : 'UNREACHABLE (skipped by the harvest)' });
}
try {
  const { data } = await axios.get('https://api.openalex.org/works', {
    params: { filter: openAlexGhanaFilter('2010-01-01'), 'per-page': 1, mailto: process.env.OPENALEX_EMAIL || 'hello@researchpadi.com' },
    timeout: 20_000,
  });
  rows.push({ source: 'OpenAlex (Ghana)', status: `OK — ${data?.meta?.count ?? '?'} works with abstracts since 2010` });
} catch (err) {
  rows.push({ source: 'OpenAlex (Ghana)', status: `FAILED — ${(err as Error).message}` });
}
console.table(rows);
process.exit(0);
