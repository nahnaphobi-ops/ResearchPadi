import { Queue, QueueEvents } from 'bullmq';
import { getRedis } from './redis';
import { childLogger } from './logger';

const log = childLogger('queue');

function getQueueOpts() {
  return {
    connection: getRedis(),
    defaultJobOptions: {
      removeOnComplete: { count: 50, age: 86400 },
      removeOnFail: { count: 100, age: 604800 },
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
    },
  };
}

export const paperQueue = new Queue('papers', getQueueOpts());
export const researchQueue = new Queue('research', getQueueOpts());
export const embeddingQueue = new Queue('embeddings', getQueueOpts());

export function setupQueueEvents() {
  const paperEvents = new QueueEvents('papers', { connection: getRedis() });

  paperEvents.on('completed', ({ jobId }) => {
    log.info({ jobId }, 'Paper job completed');
  });

  paperEvents.on('failed', ({ jobId, failedReason }) => {
    log.error({ jobId, failedReason }, 'Paper job failed');
  });

  return paperEvents;
}
