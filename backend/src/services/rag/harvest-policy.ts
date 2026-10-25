import { FirewallChallengeError, describeError } from './harvest-http.js';

/** The database is at the size limit; the harvest stops until the limit is raised. */
export class StorageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageLimitError';
  }
}

/** Errors that end a whole source (or the run) instead of just one collection. */
export function stopsSource(err: unknown): boolean {
  return err instanceof FirewallChallengeError || err instanceof StorageLimitError;
}

/** Below Supabase Free's 500 MB, with room for the app's own data. HARVEST_DB_LIMIT_MB=0 turns the check off. */
export const DEFAULT_DB_LIMIT_MB = 400;

export function databaseLimitMb(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.HARVEST_DB_LIMIT_MB?.trim();
  if (!raw) return DEFAULT_DB_LIMIT_MB;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DB_LIMIT_MB;
}

/** The message to stop with, or null when there's room (or the check is off). */
export function storageLimitMessage(sizeMb: number, limitMb: number, estimated = false): string | null {
  if (limitMb <= 0 || sizeMb < limitMb) return null;
  return `Stopped: the database is ${estimated ? 'about ' : ''}${Math.round(sizeMb)} MB, at or over HARVEST_DB_LIMIT_MB=${limitMb}. ` +
    'Raise the limit after moving Supabase to a bigger plan; the next run carries on.';
}

/**
 * Harvest collection by collection. A collection that keeps failing (UEW's col_123456789_739
 * always answers HTTP 500) is skipped and reported instead of ending the repository;
 * a firewall challenge or the storage limit still stops everything.
 * `runSet` resolves false when the page budget ran out.
 */
export async function harvestSets(sets: string[], runSet: (set: string) => Promise<boolean>): Promise<{ exhausted: boolean; failed: string[] }> {
  const failed: string[] = [];
  for (const set of sets) {
    try {
      if (!(await runSet(set))) return { exhausted: false, failed };
    } catch (err) {
      if (stopsSource(err)) throw err;
      failed.push(`${set} (${describeError(err)})`);
    }
  }
  return { exhausted: failed.length === 0, failed };
}

export function skippedSetsNote(failed: string[]): string | null {
  if (!failed.length) return null;
  const shown = failed.slice(0, 5).join('; ');
  return `Skipped ${failed.length} collection(s) that returned errors: ${shown}${failed.length > 5 ? '; …' : ''}`;
}

/** Visible in harvest_logs when chunks were saved without vectors (keyword search still finds them). */
export function embeddingNote(unembedded: number, problem: string | null): string | null {
  if (!unembedded) return null;
  return `${unembedded} chunk(s) saved without vectors (${problem ?? 'embedding provider unavailable'}). ` +
    'Fix OPENAI_API_KEY, then run src/scripts/embed-knowledge.ts.';
}

export function joinNotes(...notes: (string | null | undefined)[]): string | undefined {
  const kept = notes.filter((n): n is string => !!n);
  return kept.length ? kept.join(' | ') : undefined;
}

export const RESUME = 'resume:';

/** The position saved by a partial OpenAlex run: the text after "resume:" up to the first space. */
export function parseResume(message: string | null | undefined): string | undefined {
  if (!message?.startsWith(RESUME)) return undefined;
  return message.slice(RESUME.length).split(/\s/)[0] || undefined;
}
