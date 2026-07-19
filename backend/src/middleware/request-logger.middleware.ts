import { Request, Response, NextFunction } from 'express';
import { childLogger } from '../lib/logger.js';

const log = childLogger('http');

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    log[level]({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: (req as any).user?.id,
    }, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
}
