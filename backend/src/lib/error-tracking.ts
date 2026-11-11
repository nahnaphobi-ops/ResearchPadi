/**
 * Error tracking (Sentry). Off unless SENTRY_DSN is set, so local work and tests send nothing
 * and never load the SDK.
 *
 * Every log line at error or fatal level becomes an event (see the hook in logger.ts), so the
 * existing log.error calls are reported without touching them. Log objects can hold phone
 * numbers or paper text, so only the fields in SAFE_FIELDS leave the server, and anything that
 * looks like a Ghanaian phone number is masked.
 */

type SentryModule = typeof import('@sentry/node');

const SAFE_FIELDS = ['err', 'stack', 'jobId', 'paperId', 'runId', 'method', 'url', 'status', 'statusCode', 'source'] as const;
const MAX_FIELD_LENGTH = 2000;
const PHONE = /(\+?233|\b0)\d{9}\b/g;

let sentry: SentryModule | null = null;

export interface TrackedEvent {
  message: string;
  level: 'error' | 'fatal';
  module: string;
  extra: Record<string, string | number>;
}

function clean(value: string): string {
  return value.replace(PHONE, '[phone]').slice(0, MAX_FIELD_LENGTH);
}

/** Turn the arguments of one pino log call into what is sent. Pure, so it can be tested. */
export function eventFromLog(args: readonly unknown[], level: number, moduleName?: string): TrackedEvent {
  const first = args[0];
  const fields: Record<string, unknown> =
    first !== null && typeof first === 'object' && !(first instanceof Error) ? (first as Record<string, unknown>) : {};

  let message = 'Error logged without a message';
  if (typeof first === 'string') message = first;
  else if (typeof args[1] === 'string') message = args[1];
  else if (first instanceof Error) message = first.message;

  const extra: Record<string, string | number> = {};
  if (first instanceof Error) {
    extra.err = clean(first.message);
    if (first.stack) extra.stack = clean(first.stack);
  }
  for (const key of SAFE_FIELDS) {
    const raw = fields[key];
    const value = raw instanceof Error ? raw.message : raw;
    if (typeof value === 'number') extra[key] = value;
    // The query string can carry tokens or search text; the path is enough to find the route.
    else if (typeof value === 'string' && value) extra[key] = clean(key === 'url' ? value.split('?')[0] : value);
  }

  return {
    message: clean(message),
    level: level >= 60 ? 'fatal' : 'error',
    module: moduleName || 'unknown',
    extra,
  };
}

/** Start error tracking when SENTRY_DSN is set. Returns whether it is on. */
export async function initErrorTracking(): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;
  if (sentry) return true;
  const loaded = await import('@sentry/node');
  loaded.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Render sets this to the deployed commit, so an error can be tied to a deploy.
    release: process.env.RENDER_GIT_COMMIT,
    // The SDK collects all of these by default. Requests carry phone numbers, sign-in tokens
    // and paper text, and AI calls carry whole drafts, so none of it is sent.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
  });
  sentry = loaded;
  return true;
}

/** Called by the logger for every error and fatal line. Does nothing until tracking is on. */
export function reportLog(args: readonly unknown[], level: number, moduleName?: string): void {
  const active = sentry;
  if (!active) return;
  try {
    const event = eventFromLog(args, level, moduleName);
    active.withScope((scope) => {
      scope.setLevel(event.level);
      scope.setTag('module', event.module);
      scope.setExtras(event.extra);
      // Group by where and what was logged, not by the error text, which changes per request.
      scope.setFingerprint([event.module, event.message]);
      active.captureMessage(event.message);
    });
  } catch {
    // Reporting must never break logging.
  }
}

/** Send anything still queued; call before the process exits. */
export async function flushErrorTracking(timeoutMs = 2000): Promise<void> {
  if (!sentry) return;
  try {
    await sentry.flush(timeoutMs);
  } catch {
    // Nothing useful to do if the last events cannot be sent.
  }
}
