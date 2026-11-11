import pino from 'pino';
import { reportLog } from './error-tracking.js';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  base: { service: 'researchpadi-api' },
  hooks: {
    // Error and fatal lines also go to error tracking, which does nothing unless SENTRY_DSN is set.
    logMethod(args, method, level) {
      if (level >= 50) reportLog(args, level, (this.bindings() as { module?: string }).module);
      method.apply(this, args);
    },
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'password_hash',
      'token',
      'refreshToken',
      'otp',
      'otp_hint',
      '*.secret',
      '*.apiKey',
      '*.password',
    ],
    censor: '[REDACTED]',
  },
});

export function childLogger(name: string) {
  return logger.child({ module: name });
}
