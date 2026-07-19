import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { getRedis } from '../lib/redis.js';
import { childLogger } from '../lib/logger.js';

const log = childLogger('health');

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    aiProviders: CheckResult;
    queues: CheckResult;
  };
}

interface CheckResult {
  status: 'ok' | 'error' | 'skipped';
  latencyMs?: number;
  message?: string;
}

/**
 * Comprehensive health check endpoint.
 * GET /health — returns full system health
 * GET /health/live — simple liveness probe (always 200)
 * GET /health/ready — readiness probe (checks DB + Redis)
 */
export async function healthCheck(req: Request, res: Response) {
  const start = Date.now();
  const checks = await runChecks();

  const allOk = Object.values(checks).every(c => c.status === 'ok' || c.status === 'skipped');
  const anyError = Object.values(checks).some(c => c.status === 'error');

  const status: HealthStatus['status'] = allOk ? 'healthy' : anyError ? 'unhealthy' : 'degraded';

  const result: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  };

  const httpStatus = status === 'unhealthy' ? 503 : 200;
  res.status(httpStatus).json(result);
}

export async function liveness(_req: Request, res: Response) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}

export async function readiness(req: Request, res: Response) {
  const dbOk = await checkDatabase();
  const redisOk = await checkRedis();

  const ready = dbOk.status === 'ok' && redisOk.status === 'ok';
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: { database: dbOk, redis: redisOk },
  });
}

async function runChecks() {
  const [database, redis, aiProviders, queues] = await Promise.all([
    checkDatabase().catch(() => ({ status: 'error' as const, message: 'Check failed' })),
    checkRedis().catch(() => ({ status: 'error' as const, message: 'Check failed' })),
    checkAiProviders(),
    checkQueues(),
  ]);

  return { database, redis, aiProviders, queues };
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    const latencyMs = Date.now() - start;
    if (error) return { status: 'error', latencyMs, message: error.message };
    return { status: 'ok', latencyMs };
  } catch (err: any) {
    return { status: 'error', latencyMs: Date.now() - start, message: err.message };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'error', latencyMs: Date.now() - start, message: err.message };
  }
}

async function checkAiProviders(): Promise<CheckResult> {
  const providers: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (process.env.PERPLEXITY_API_KEY) providers.push('perplexity');

  if (providers.length === 0) {
    return { status: 'skipped', message: 'No AI providers configured' };
  }

  return { status: 'ok', message: `Configured: ${providers.join(', ')}` };
}

async function checkQueues(): Promise<CheckResult> {
  try {
    // Just check Redis is reachable for queues
    const redis = getRedis();
    await redis.ping();
    return { status: 'ok', message: 'Queues operational' };
  } catch {
    return { status: 'error', message: 'Queue backend (Redis) unreachable' };
  }
}
