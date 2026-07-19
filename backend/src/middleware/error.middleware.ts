import { Request, Response, NextFunction } from 'express';
import { childLogger } from '../lib/logger.js';

const log = childLogger('error-handler');

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;
  log.error({ err: err.message, stack: err.stack, method: req.method, url: req.originalUrl }, 'Unhandled error');

  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
