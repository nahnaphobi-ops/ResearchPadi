import app from './app.js';
import { CONFIG } from './config/index.js';
import { validateEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { startPaperWorker, stopPaperWorker } from './workers/paper.worker.js';
import { initQueues, setupQueueEvents } from './lib/queue.js';
import { closeRedis } from './lib/redis.js';
import { closePools } from './db/supabase.js';
import './jobs/harvest.job.js';
import './jobs/keepalive.job.js';

const log = logger.child({ module: 'index' });

async function bootstrap() {
  const env = validateEnv();

  if (!env.valid) {
    log.fatal({ missing: env.missing }, 'Missing required environment variables');
    process.exit(1);
  }

  if (env.warnings.length > 0) {
    log.warn({ missing: env.warnings }, 'Recommended environment variables not set');
  }

  const enableApi = process.env.API_ENABLED !== 'false';
  const enableWorker = process.env.WORKER_ENABLED !== 'false';

  log.info({ nodeEnv: CONFIG.NODE_ENV, port: CONFIG.PORT, enableApi, enableWorker }, 'Starting ResearchPadi');

  await initQueues();
  if (enableWorker) {
    setupQueueEvents();
    await startPaperWorker();
  }

  let server: ReturnType<typeof app.listen> | null = null;
  if (enableApi) {
    server = app.listen(CONFIG.PORT, () => {
      log.info({ port: CONFIG.PORT }, 'Server running');
    });
  }

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutting down gracefully');
    if (server) server.close();
    await stopPaperWorker();
    await closeRedis();
    await closePools();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  log.fatal({ err: err.message }, 'Failed to start ResearchPadi');
  process.exit(1);
});
