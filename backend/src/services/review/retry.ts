
export interface RetryOptions {
  /** Total attempts, including the first. */
  attempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: { attempt: number; delayMs: number; status?: number }) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The SDK's APIConnectionError, or a subclass such as APIConnectionTimeoutError, found by class name. */
function isConnectionError(err: unknown): boolean {
  for (let proto = err && typeof err === 'object' ? Object.getPrototypeOf(err) : null; proto; proto = Object.getPrototypeOf(proto)) {
    if (proto.constructor?.name === 'APIConnectionError') return true;
  }
  return false;
}

/** 429 rate limit, 529 overloaded (or 503), or no response at all. 400s and auth errors are not retried. */
export function isRetryable(err: unknown): boolean {
  // The SDK's APIConnectionError and its timeout subclass (checked by name, so
  // this file needs no SDK import: model clients live in the gateway).
  if (isConnectionError(err)) return true;
  const e = err as { status?: number; error?: { error?: { type?: string } } } | null;
  if (!e) return false;
  if (e.status === 429 || e.status === 529 || e.status === 503) return true;
  return e.error?.error?.type === 'overloaded_error' || e.error?.error?.type === 'rate_limit_error';
}

function retryAfterMs(err: unknown): number | null {
  const headers = (err as { headers?: Headers | Record<string, string> } | null)?.headers;
  if (!headers) return null;
  const raw = typeof (headers as Headers).get === 'function'
    ? (headers as Headers).get('retry-after')
    : (headers as Record<string, string>)['retry-after'];
  const seconds = raw ? Number(raw) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

/** retry-after when the API sends it, else exponential backoff with jitter. */
export function retryDelayMs(err: unknown, attempt: number, base = 2000, max = 60_000, random = Math.random): number {
  const hinted = retryAfterMs(err);
  if (hinted !== null) return Math.min(hinted, max);
  const exp = base * 2 ** (attempt - 1);
  return Math.min(Math.round(exp * (0.8 + random() * 0.4)), max);
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= opts.attempts || !isRetryable(err)) throw err;
      const delayMs = retryDelayMs(err, attempt, opts.baseDelayMs, opts.maxDelayMs);
      opts.onRetry?.({ attempt, delayMs, status: (err as { status?: number })?.status });
      await sleep(delayMs);
    }
  }
}
