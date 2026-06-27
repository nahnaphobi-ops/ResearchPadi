import app from './app';
import { CONFIG } from './config';
import { validateEnv } from './config/env';
import { logger } from './lib/logger';
import { startPaperWorker, stopPaperWorker } from './workers/paper.worker';
import { setupQueueEvents } from './lib/queue';
import { closeRedis } from './lib/redis';
import { closePools } from './db/supabase';
import './jobs/harvest.job';
import './jobs/keepalive.job';

const log = logger.child({ module: 'index' });

function bootstrap() {
  const env = validateEnv();

  if (!env.valid) {
    log.fatal({ missing: env.missing }, 'Missing required environment variables');
    process.exit(1);
  }

  if (env.warnings.length > 0) {
    log.warn({ missing: env.warnings }, 'Recommended environment variables not set');
  }

  log.info({ nodeEnv: CONFIG.NODE_ENV, port: CONFIG.PORT }, 'Starting ResearchPadi API');

  setupQueueEvents();
  startPaperWorker();

  const server = app.listen(CONFIG.PORT, () => {
    log.info({ port: CONFIG.PORT }, 'Server running');
  });

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutting down gracefully');
    server.close();
    await stopPaperWorker();
    await closeRedis();
    await closePools();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
