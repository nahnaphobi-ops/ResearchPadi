import { Queue, QueueEvents } from 'bullmq';
import { getRedis } from './redis.js';
import { childLogger } from './logger.js';

const log = childLogger('queue');

function getQueueOpts() {
  return {
    connection: getRedis() as any,
    defaultJobOptions: {
      removeOnComplete: { count: 50, age: 86400 },
      removeOnFail: { count: 100, age: 604800 },
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
    },
  };
}

function createQueue(name: string): Queue | null {
  const connection = getRedis();
  if (!connection) {
    log.warn({ queue: name }, 'Redis not configured — queue disabled');
    return null;
  }
  return new Queue(name, getQueueOpts());
}

export const paperQueue = createQueue('papers');
export const researchQueue = createQueue('research');
export const embeddingQueue = createQueue('embeddings');

export function setupQueueEvents() {
  const connection = getRedis();
  if (!connection) return null;

  const paperEvents = new QueueEvents('papers', { connection: connection as any });

  paperEvents.on('completed', ({ jobId }) => {
    log.info({ jobId }, 'Paper job completed');
  });

  paperEvents.on('failed', ({ jobId, failedReason }) => {
    log.error({ jobId, failedReason }, 'Paper job failed');
  });

  return paperEvents;
}
