import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Token counts exactly as the API returned them for one call (or summed over calls). */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface Rates {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface ModelPricing extends Rates {
  longPrompt?: Rates & { overTokens: number };
}

export interface PricingTable {
  models: Record<string, ModelPricing>;
}

export interface Cost {
  usd: number;
  ghs: number;
  /** The long-prompt prices applied (Haiku over 100K prompt tokens). */
  longPrompt: boolean;
}

export const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
export const ZERO_COST: Cost = { usd: 0, ghs: 0, longPrompt: false };

// pricing.json sits next to this file in src/ and, copied by scripts/copy-assets, in dist/.
const PRICING_PATH = join(dirname(fileURLToPath(import.meta.url)), 'pricing.json');
let cached: PricingTable | null = null;

export function loadPricing(path = PRICING_PATH): PricingTable {
  if (path === PRICING_PATH && cached) return cached;
  const table = JSON.parse(readFileSync(path, 'utf8')) as PricingTable;
  if (path === PRICING_PATH) cached = table;
  return table;
}

export function hasPricing(model: string, table: PricingTable = loadPricing()): boolean {
  return Boolean(table.models[model]);
}

/** Usage block from a Messages API response, with nulls as 0. */
export function usageFromApi(u: {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined): TokenUsage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  };
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

/**
 * Cost of ONE API call. Price each call on its own and add the results: the
 * Haiku long-prompt tier depends on that one request's prompt length, so
 * pricing summed usage would be wrong once a stage makes several calls.
 */
export function costOf(model: string, usage: TokenUsage, usdToGhs: number, table: PricingTable = loadPricing()): Cost {
  const p = table.models[model];
  if (!p) throw new Error(`No price for model ${model} in services/review/pricing.json`);
  const promptTokens = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const longPrompt = Boolean(p.longPrompt && promptTokens > p.longPrompt.overTokens);
  const r: Rates = longPrompt && p.longPrompt ? p.longPrompt : p;
  const usd =
    (usage.inputTokens * r.input +
      usage.outputTokens * r.output +
      usage.cacheReadTokens * r.cacheRead +
      usage.cacheWriteTokens * r.cacheWrite) /
    1_000_000;
  return { usd, ghs: usd * usdToGhs, longPrompt };
}

export function addCost(a: Cost, b: Cost): Cost {
  return { usd: a.usd + b.usd, ghs: a.ghs + b.ghs, longPrompt: a.longPrompt || b.longPrompt };
}
