/**
 * Run the Ghanaian repository harvest on demand.
 *   npx tsx src/scripts/harvest-now.ts                 # all repositories
 *   npx tsx src/scripts/harvest-now.ts UCC UEW --pages=2
 */
import 'dotenv/config';
import { runFullHarvest } from '../services/rag/harvester.service.js';
import { GHANA_REPOSITORIES } from '../services/rag/repositories.js';

const args = process.argv.slice(2);
const pagesArg = args.find((a) => a.startsWith('--pages='));
const repos = args.filter((a) => !a.startsWith('--'));
const unknown = repos.filter((r) => !GHANA_REPOSITORIES.some((g) => g.name === r));
if (unknown.length) {
  console.error(`Unknown repositories: ${unknown.join(', ')}. Known: ${GHANA_REPOSITORIES.map((g) => g.name).join(', ')}`);
  process.exit(1);
}

const results = await runFullHarvest({ repos, maxPages: pagesArg ? Number(pagesArg.split('=')[1]) : undefined });
console.table(results);
process.exit(0);
