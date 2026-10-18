import cron from 'node-cron';
import { runFullHarvest } from '../services/rag/harvester.service.js';
import { childLogger } from '../lib/logger.js';

const log = childLogger('harvest-job');
// A first backfill can take hours (AJOL is paced at one request every 20 s).
let running = false;

// Run every Sunday at 2:00 AM GMT
cron.schedule('0 2 * * 0', async () => {
  if (running) {
    log.warn('Previous weekly harvest still running; skipped');
    return;
  }
  running = true;
  log.info('Starting weekly RAG harvest');
  try {
    const results = await runFullHarvest();
    log.info({ results }, 'Weekly RAG harvest completed');
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Weekly RAG harvest crashed');
  } finally {
    running = false;
  }
});
