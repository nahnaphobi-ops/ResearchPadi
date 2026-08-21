import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  base: { service: 'researchpadi-api' },
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
