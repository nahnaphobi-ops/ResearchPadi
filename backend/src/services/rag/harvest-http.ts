import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import http from 'node:http';
import https from 'node:https';
import { childLogger } from '../../lib/logger.js';

const log = childLogger('harvest-http');

/** Names the harvester and a contact, so repository admins can reach us instead of blocking us. */
export const HARVEST_USER_AGENT = 'ResearchPadi-Harvester/2.1 (+https://researchpadi.com; hello@researchpadi.com)';

// A fresh connection per request. Pages are seconds apart (embedding runs in between) and the
// university servers drop idle keep-alive connections after ~5 s, which showed up as "socket hang up".
const client = axios.create({
  httpAgent: new http.Agent({ keepAlive: false }),
  httpsAgent: new https.Agent({ keepAlive: false }),
  headers: { 'User-Agent': HARVEST_USER_AGENT },
});

/** The site's firewall asked for a browser challenge (AJOL's AWS WAF answers 202 with an empty body). */
export class FirewallChallengeError extends Error {
  constructor(public readonly host: string) {
    super(`${host} firewall challenged the harvester (too many requests); try again later`);
    this.name = 'FirewallChallengeError';
  }
}

class EmptyResponseError extends Error {
  constructor(host: string, status: number) {
    super(`${host} returned an empty response (HTTP ${status})`);
    this.name = 'EmptyResponseError';
  }
}

const RETRYABLE_CODES = new Set(['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'ERR_SOCKET_CONNECTION_TIMEOUT']);
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
/** Longer waits (e.g. OpenAlex's daily budget) aren't worth holding the weekly job for. */
const MAX_RETRY_AFTER_MS = 5 * 60_000;

export function isFirewallChallenge(res: Pick<AxiosResponse, 'status' | 'headers'>): boolean {
  return res.status === 202 || !!res.headers?.['x-amzn-waf-action'];
}

function retryAfterMs(err: unknown): number | undefined {
  const value = (err as AxiosError).response?.headers?.['retry-after'];
  if (value == null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const at = Date.parse(String(value));
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof FirewallChallengeError || err instanceof EmptyResponseError) return true;
  const e = err as AxiosError;
  if (e.response) {
    if (!RETRYABLE_STATUS.has(e.response.status)) return false;
    return (retryAfterMs(err) ?? 0) <= MAX_RETRY_AFTER_MS;
  }
  return !!e.code && RETRYABLE_CODES.has(e.code) || /socket hang up/i.test(e.message ?? '');
}

/** One line for harvest_logs: the status and the server's own explanation when it gave one. */
export function describeError(err: unknown): string {
  const e = err as AxiosError<unknown>;
  if (!e?.isAxiosError || !e.response) return (err as Error)?.message ?? String(err);
  const host = e.config?.url ? new URL(e.config.url).host : 'server';
  const body = e.response.data;
  let detail = '';
  if (body && typeof body === 'object') {
    const b = body as { message?: unknown; error?: unknown };
    detail = String(b.message ?? b.error ?? '');
  } else if (typeof body === 'string' && !/^\s*</.test(body)) {
    detail = body;
  }
  detail = detail.replace(/\s+/g, ' ').trim().slice(0, 200);
  return `HTTP ${e.response.status} from ${host}${detail ? `: ${detail}` : ''}`;
}

const lastRequestAt = new Map<string, number>();
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface HarvestGetOptions {
  /** Attempts after the first (default 3). */
  retries?: number;
  /** First wait after a network error or 5xx; tripled each attempt (default 5 s). */
  baseDelayMs?: number;
  /** First wait after a firewall challenge; doubled each attempt (default 2 min). */
  challengeDelayMs?: number;
  /** Minimum gap between requests to the same host (default 1 s). */
  minIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Swappable for tests. */
  request?: (url: string, config: AxiosRequestConfig) => Promise<AxiosResponse>;
}

/**
 * GET for harvesting: paced per host, no keep-alive, and retried with backoff on
 * dropped connections, timeouts, 429/5xx and firewall challenges. Other errors throw at once.
 */
export async function harvestGet<T = unknown>(url: string, config: AxiosRequestConfig = {}, opts: HarvestGetOptions = {}): Promise<AxiosResponse<T>> {
  const { retries = 3, baseDelayMs = 5_000, challengeDelayMs = 120_000, minIntervalMs = 1_000, sleep = defaultSleep } = opts;
  const request = opts.request ?? ((u: string, c: AxiosRequestConfig) => client.get(u, c));
  const host = new URL(url).host;

  for (let attempt = 0; ; attempt++) {
    const wait = (lastRequestAt.get(host) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt.set(host, Date.now());
    try {
      const res = await request(url, { timeout: 60_000, ...config });
      if (isFirewallChallenge(res)) throw new FirewallChallengeError(host);
      if (res.data == null || res.data === '') throw new EmptyResponseError(host, res.status);
      return res as AxiosResponse<T>;
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const delay = err instanceof FirewallChallengeError
        ? challengeDelayMs * 2 ** attempt
        : retryAfterMs(err) ?? baseDelayMs * 3 ** attempt;
      log.warn({ host, attempt: attempt + 1, retries, delayMs: delay, err: describeError(err) }, 'Harvest request failed; retrying');
      await sleep(delay);
    }
  }
}
