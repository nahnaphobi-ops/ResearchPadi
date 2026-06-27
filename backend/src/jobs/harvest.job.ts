import cron from 'node-cron';
import { runFullHarvest } from '../services/rag/harvester.service';

// Run every Sunday at 2:00 AM GMT
cron.schedule('0 2 * * 0', async () => {
  console.log('[Job] Starting weekly RAG harvest');
  await runFullHarvest();
  console.log('[Job] Weekly RAG harvest completed');
});
