import { Request, Response, NextFunction } from 'express';
import { childLogger } from '../lib/logger.js';

const log = childLogger('error-handler');

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;
  log.error({ err: err.message, stack: err.stack, method: req.method, url: req.originalUrl }, 'Unhandled error');

  const isProd = process.env.NODE_ENV === 'production';
  res.status(statusCode).json({
    error: (isProd && statusCode >= 500) ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
    stack: isProd ? null : err.stack,
  });
};
