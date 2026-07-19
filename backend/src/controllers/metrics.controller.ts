import { Request, Response } from 'express';
import { supabase, getWritePool } from '../db/supabase.js';
import { getRedis } from '../lib/redis.js';
import { aiCircuitBreaker } from '../lib/circuit-breaker.js';
import { childLogger } from '../lib/logger.js';

const log = childLogger('metrics');

/**
 * Prometheus-compatible metrics endpoint.
 * GET /metrics — exposes key operational metrics in text format.
 */
export async function metricsEndpoint(req: Request, res: Response) {
  try {
    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    const lines: string[] = [];

    lines.push('# HELP researchpadi_uptime_seconds Server uptime in seconds');
    lines.push('# TYPE researchpadi_uptime_seconds gauge');
    lines.push(`researchpadi_uptime_seconds ${Math.floor(uptime)}`);

    lines.push('# HELP researchpadi_memory_bytes Memory usage in bytes');
    lines.push('# TYPE researchpadi_memory_bytes gauge');
    lines.push(`researchpadi_memory_bytes{type="rss"} ${mem.rss}`);
    lines.push(`researchpadi_memory_bytes{type="heap_used"} ${mem.heapUsed}`);
    lines.push(`researchpadi_memory_bytes{type="heap_total"} ${mem.heapTotal}`);
    lines.push(`researchpadi_memory_bytes{type="external"} ${mem.external || 0}`);

    lines.push('# HELP researchpadi_cpu_usage_microseconds CPU time in microseconds');
    lines.push('# TYPE researchpadi_cpu_usage_microseconds counter');
    lines.push(`researchpadi_cpu_usage_microseconds{type="user"} ${cpuUsage.user}`);
    lines.push(`researchpadi_cpu_usage_microseconds{type="system"} ${cpuUsage.system}`);

    lines.push('# HELP researchpadi_node_version Node.js version');
    lines.push('# TYPE researchpadi_node_version gauge');
    lines.push(`researchpadi_node_version{version="${process.version}"} 1`);

    // Event loop lag
    const lag = await measureEventLoopLag();
    lines.push('# HELP researchpadi_event_loop_lag_ms Event loop lag in milliseconds');
    lines.push('# TYPE researchpadi_event_loop_lag_ms gauge');
    lines.push(`researchpadi_event_loop_lag_ms ${lag}`);

    // Active handles (Node.js internal, wrapped for type safety)
    try {
      const activeHandles = (process as any)._getActiveHandles().length;
      lines.push('# HELP researchpadi_active_handles Active handles count');
      lines.push('# TYPE researchpadi_active_handles gauge');
      lines.push(`researchpadi_active_handles ${activeHandles}`);
    } catch {
      // skip if unavailable
    }

    // DB pool stats
    lines.push('# HELP researchpadi_db_pool_size Database connection pool size');
    lines.push('# TYPE researchpadi_db_pool_size gauge');
    try {
      const pool = getWritePool();
      lines.push(`researchpadi_db_pool_size{type="total"} ${pool.totalCount}`);
      lines.push(`researchpadi_db_pool_size{type="idle"} ${pool.idleCount}`);
      lines.push(`researchpadi_db_pool_size{type="waiting"} ${pool.waitingCount}`);
    } catch {
      lines.push(`researchpadi_db_pool_size{type="error"} 1`);
    }

    // Circuit breaker state
    lines.push('# HELP researchpadi_circuit_breaker Circuit breaker state (1=open, 0=closed)');
    lines.push('# TYPE researchpadi_circuit_breaker gauge');
    const providers = ['ai:anthropic', 'ai:openai', 'ai:perplexity'];
    for (const key of providers) {
      const info = aiCircuitBreaker.getStateInfo(key);
      lines.push(`researchpadi_circuit_breaker{provider="${key.replace('ai:', '')}"} ${info.state === 'open' ? 1 : 0}`);
    }

    // DB record counts
    const [userCount, paperCount] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('papers').select('*', { count: 'exact', head: true }),
    ]);

    lines.push('# HELP researchpadi_db_records Database record counts');
    lines.push('# TYPE researchpadi_db_records gauge');
    lines.push(`researchpadi_db_records{table="users"} ${userCount.count || 0}`);
    lines.push(`researchpadi_db_records{table="papers"} ${paperCount.count || 0}`);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(lines.join('\n') + '\n');
  } catch (err: any) {
    log.error({ err: err.message }, 'Metrics generation failed');
    res.status(500).setHeader('Content-Type', 'text/plain');
    res.send(`# ERROR: ${err.message}\n`);
  }
}

function measureEventLoopLag(): Promise<number> {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => {
      resolve(Date.now() - start);
    });
  });
}
