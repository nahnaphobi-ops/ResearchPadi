/**
 * Run the Ghanaian library harvest on demand.
 *   npm run rag:harvest                       # every repository and journal, then OpenAlex
 *   npm run rag:harvest -- UCC UEW --pages=2  # just these
 *   npm run rag:harvest -- OpenAlex           # just OpenAlex (Ghana)
 */
import 'dotenv/config';
import { runFullHarvest } from '../services/rag/harvester.service.js';
import { GHANA_REPOSITORIES } from '../services/rag/repositories.js';

const args = process.argv.slice(2);
const pagesArg = args.find((a) => a.startsWith('--pages='));
const names = args.filter((a) => !a.startsWith('--'));
const openAlex = names.length === 0 || names.some((n) => n.toLowerCase() === 'openalex');
const repos = names.filter((n) => n.toLowerCase() !== 'openalex');
const unknown = repos.filter((r) => !GHANA_REPOSITORIES.some((g) => g.name === r));
if (unknown.length) {
  console.error(`Unknown repositories: ${unknown.join(', ')}. Known: ${GHANA_REPOSITORIES.map((g) => g.name).join(', ')}`);
  process.exit(1);
}

const maxPages = pagesArg ? Number(pagesArg.split('=')[1]) : undefined;
const results = await runFullHarvest({ repos: names.length ? repos : undefined, openAlex, maxPages });
console.table(results);
process.exit(0);
