/**
 * Run the AI review on a paper file and print what it suggests and what it cost.
 * Nothing is written to the database (no review rows, no ai_usage_logs rows).
 *
 *   npm run review:dry-run
 *   npm run review:dry-run -- path/to/paper.md --sources path/to/sources.json
 *   npm run review:dry-run -- --compare      (default and compare supervisor, same reader notes)
 *
 * Needs ANTHROPIC_API_KEY. Every run makes real API calls and costs real money:
 * the totals printed at the end are from the API's own token counts.
 * With no paper given it uses the fictional sample in scripts/fixtures.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PaperSource } from '../services/pipeline/paper-source.js';
import { reviewConfig } from '../services/review/config.js';
import { runReviewPipeline, type Spend } from '../services/review/pipeline.js';
import { addCost, addUsage, hasPricing } from '../services/review/pricing.js';
import { noteCount } from '../services/review/schema.js';
import { guardSuggestions } from '../services/review/spans.js';

const here = dirname(fileURLToPath(import.meta.url));

// Exit after a short pause, not at once: on Windows, process.exit while the
// logger's worker thread is still starting aborts Node with a libuv assertion.
const finish = (code: number) => new Promise<never>(() => setTimeout(() => process.exit(code), 300));
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--sources');

const paperPath = positional[0] ?? join(here, 'fixtures', 'review-sample-paper.md');
const sourcesPath = option('--sources') ?? (positional[0] ? undefined : join(here, 'fixtures', 'review-sample-sources.json'));
const compare = args.includes('--compare');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set (backend/.env). The dry run calls the real API.');
  await finish(1);
}

const cfg = reviewConfig();
const paper = readFileSync(paperPath, 'utf8');
const sources: PaperSource[] = sourcesPath ? JSON.parse(readFileSync(sourcesPath, 'utf8')) : [];
const supervisors = compare ? [cfg.supervisorModel, cfg.compareModel] : [cfg.supervisorModel];
for (const model of [cfg.readerModel, ...supervisors]) {
  if (!hasPricing(model)) {
    console.error(`No price for ${model} in services/review/pricing.json`);
    await finish(1);
  }
}

const usd = (n: number) => `$${n.toFixed(4)}`;
const ghs = (n: number) => `GHS ${n.toFixed(2)}`;
const tokens = (s: Spend) =>
  `in ${s.usage.inputTokens}, out ${s.usage.outputTokens}, cache read ${s.usage.cacheReadTokens}, cache write ${s.usage.cacheWriteTokens}`;
const line = (label: string, s: Spend) => console.log(`  ${label.padEnd(34)} ${tokens(s)}  =  ${usd(s.cost.usd)}  /  ${ghs(s.cost.ghs)}`);

console.log(`Paper: ${paperPath} (${paper.length} characters, ${sources.length} sources)`);
console.log(`Reader ${cfg.readerModel}; supervisor ${supervisors.join(' vs ')}; up to ${cfg.maxSuggestions} suggestions; USD_TO_GHS ${cfg.usdToGhs}`);
console.log('Running... (this makes real API calls)\n');

const started = Date.now();
const outcome = await runReviewPipeline({ paper, sources, supervisorModels: supervisors, cfg, meta: { dryRun: true }, logUsage: false });

if (outcome.reader) {
  const r = outcome.reader;
  console.log(`Reader: strategy ${r.strategy}, ${r.promptTokens} prompt tokens counted, ${r.calls} call(s), ${r.sourcesSent}/${r.sourcesTotal} sources sent, ${noteCount(r.notes)} notes`);
} else {
  console.log(`Reader FAILED, supervisor ran on the paper alone (the run would be "degraded"): ${outcome.readerError}`);
}

let total: Spend = { usage: outcome.readerSpend.usage, cost: outcome.readerSpend.cost };
for (const sup of outcome.supervisors) {
  console.log(`\n=== Supervisor ${sup.model} ===`);
  total = { usage: addUsage(total.usage, sup.spend.usage), cost: addCost(total.cost, sup.spend.cost) };
  if (!sup.result) {
    console.log(`FAILED (the run would be "failed"): ${sup.error}`);
    continue;
  }
  const { kept, drops } = guardSuggestions(paper, sup.result.items, cfg.maxSuggestions);
  const cut = sup.result.truncated ? ` (output hit max_tokens${sup.result.salvaged ? '; complete items salvaged' : ''})` : '';
  console.log(`${sup.result.items.length} returned, ${kept.length} kept after the verbatim check${cut}`);
  console.log(`Dropped: ${JSON.stringify(drops)}`);
  kept.forEach((s, i) => {
    console.log(`\n${i + 1}. [${s.severity}] ${s.type} - ${s.section}`);
    console.log(`   original:  ${s.original}`);
    console.log(`   suggested: ${s.suggested || '(delete)'}`);
    console.log(`   reason:    ${s.reason}`);
  });
}

console.log('\n=== Real token usage and cost (from the API responses) ===');
line(`reader ${cfg.readerModel}`, outcome.readerSpend);
for (const sup of outcome.supervisors) line(`supervisor ${sup.model}`, sup.spend);
line('total', total);
console.log(`\nTook ${Math.round((Date.now() - started) / 1000)}s`);
await finish(0);
