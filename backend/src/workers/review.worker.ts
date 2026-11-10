import { Worker, Job } from 'bullmq';
import { getRedis, redisSupportsBullmq } from '../lib/redis.js';
import { CONFIG } from '../config/index.js';
import { childLogger } from '../lib/logger.js';
import { processReviewJob, type ReviewJobData } from '../services/review/review.service.js';

/**
 * Runs AI reviews of finished papers (services/review). It writes only the
 * review tables; the paper is changed only when the student accepts a
 * suggestion. API rate limits are shared with paper generation through the
 * gateway's Redis counters, so reviews wait rather than starve papers.
 */

const log = childLogger('review-worker');

let reviewWorker: Worker | null = null;

async function runReview(job: Job<ReviewJobData>) {
  await processReviewJob(job.data);
}

export async function startReviewWorker(): Promise<Worker | null> {
  if (reviewWorker) return reviewWorker;

  const connection = getRedis();
  if (!connection || !(await redisSupportsBullmq())) {
    log.warn('Review worker disabled: Redis missing or too old for BullMQ');
    return null;
  }

  const concurrency = Math.max(1, CONFIG.QUEUE.REVIEW_CONCURRENCY);
  reviewWorker = new Worker<ReviewJobData>('reviews', runReview, {
    connection: connection as any,
    concurrency,
    limiter: { max: concurrency * 2, duration: 60000 },
  });

  reviewWorker.on('failed', (job, err) => {
    // processReviewJob records its own failures on the run; this is a last resort log.
    log.error({ jobId: job?.id, err: err.message }, 'Review job failed');
  });

  reviewWorker.on('ready', () => {
    log.info({ concurrency }, 'Review worker ready');
  });

  return reviewWorker;
}

export async function stopReviewWorker(): Promise<void> {
  if (reviewWorker) {
    await reviewWorker.close();
    reviewWorker = null;
  }
}
