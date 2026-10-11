// Imported first by index.ts, before anything reads NODE_ENV.
//
// Development mode turns on local-only shortcuts: any phone signs in with the
// demo code, subscription checks are skipped, and error responses include stack
// traces. Render sets RENDER=true on every service, so a hosted instance always
// runs as production even if NODE_ENV was set to something else by mistake.
if (process.env.RENDER === 'true' && process.env.NODE_ENV !== 'production') {
  console.warn(
    `NODE_ENV is "${process.env.NODE_ENV ?? ''}" on Render; running as production. ` +
      'Set NODE_ENV=production in the Render dashboard to silence this warning.',
  );
  process.env.NODE_ENV = 'production';
}

export {};
