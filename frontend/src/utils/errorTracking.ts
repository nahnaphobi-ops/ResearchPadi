/**
 * Error tracking (Sentry). Off unless VITE_SENTRY_DSN is set at build time. The SDK is a
 * separate chunk fetched only then, so it adds nothing to the first load when it is off.
 */

type SentryModule = typeof import('@sentry/react');

let sentry: Promise<SentryModule> | null = null;

/** Start error tracking. Once loaded, the SDK also reports uncaught errors and rejected promises. */
export function initErrorTracking(): void {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
  if (!dsn || sentry) return;
  sentry = import('@sentry/react').then((loaded) => {
    loaded.init({
      dsn,
      environment: import.meta.env.MODE,
      // The SDK collects all of these by default. Requests carry sign-in tokens and the
      // student's own writing, so none of it is sent.
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
    return loaded;
  });
  // The chunk can fail to load on a bad connection; the app carries on without tracking.
  sentry.catch(() => {
    sentry = null;
  });
}

/** Report an error caught by the app itself (see ErrorBoundary). Does nothing when tracking is off. */
export function reportError(error: unknown, componentStack?: string): void {
  sentry
    ?.then((loaded) => loaded.captureException(error, componentStack ? { extra: { componentStack } } : undefined))
    .catch(() => {});
}
