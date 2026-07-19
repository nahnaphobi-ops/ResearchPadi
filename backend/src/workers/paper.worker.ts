import { Worker, Job } from 'bullmq';
import { getRedis } from '../lib/redis.js';
import { childLogger } from '../lib/logger.js';
import { supabase } from '../db/supabase.js';
import { performResearch } from '../services/pipeline/research.service.js';
import { draftChapter } from '../services/pipeline/draft.service.js';
import { supervisePaper } from '../services/pipeline/supervise.service.js';
import { assembleFullPaper, generateAbstract, generateReferences } from '../services/pipeline/assemble.service.js';
import { CHAPTER_STRUCTURE } from '../services/ai/prompts.js';
import { runCitationVerification } from '../services/citations/verify/citation-verify.service.js';

const log = childLogger('paper-worker');

interface PaperJobData {
  paperId: string;
  topic: string;
  course: string;
  institution_name: string;
  institution_type: string;
  programme: string;
  supervisor_name?: string;
  target_word_count?: number;
  research_questions?: string;
}

async function updateProgress(paperId: string, step: string) {
  await supabase.from('papers').update({ progress_step: step }).eq('id', paperId);
  log.info({ paperId, step }, 'Pipeline progress');
}

async function runPipeline(job: Job<PaperJobData>) {
  const d = job.data;
  log.info({ paperId: d.paperId, topic: d.topic }, 'Starting paper pipeline');

  try {
    // Step 1: Research
    await job.updateProgress(10);
    await updateProgress(d.paperId, 'Researching sources...');
    const research = await performResearch(d.topic);

    await supabase.from('papers').update({
      progress_step: 'Drafting chapters...',
      sources_used: research.citations,
    }).eq('id', d.paperId);

    // Step 2: Draft chapters
    const chapters: string[] = [];
    const userWordTarget = d.target_word_count ? Math.floor(d.target_word_count / 5) : undefined;
    const chaptersToDraft = [
      { num: 1, ...CHAPTER_STRUCTURE.chapter1 },
      { num: 2, ...CHAPTER_STRUCTURE.chapter2 },
      { num: 3, ...CHAPTER_STRUCTURE.chapter3 },
      { num: 4, ...CHAPTER_STRUCTURE.chapter4 },
      { num: 5, ...CHAPTER_STRUCTURE.chapter5 },
    ];

    for (let i = 0; i < chaptersToDraft.length; i++) {
      const ch = chaptersToDraft[i];
      const progress = 10 + Math.floor((i / chaptersToDraft.length) * 50);
      await job.updateProgress(progress);
      await updateProgress(d.paperId, `Drafting Chapter ${ch.num}...`);

      const wordTarget = userWordTarget || ch.wordTarget;
      const draft = await draftChapter(
        ch.num, ch.title, ch.sections, wordTarget,
        d, research.webData, chapters.join('\n\n'), research.citations
      );
      chapters.push(draft);
    }

    // Step 3: Assemble
    await job.updateProgress(70);
    await updateProgress(d.paperId, 'Assembling and refining...');
    const fullContentBeforeSupervision = chapters.join('\n\n');
    const abstract = await generateAbstract(fullContentBeforeSupervision, d);
    const references = await generateReferences(research.citations, d.institution_type);
    const assembledPaper = assembleFullPaper(chapters, abstract, references);

    // Step 4: Supervision
    await job.updateProgress(85);
    await updateProgress(d.paperId, 'Human voice supervision pass...');
    const finalizedPaper = await supervisePaper(assembledPaper, d, research.citations);

    // Step 4.5: Citation verification (after supervision, before delivery)
    await job.updateProgress(92);
    await updateProgress(d.paperId, 'Verifying citations against real sources...');
    try {
      const citationSummary = await runCitationVerification({
        paperId: d.paperId,
        fullContent: finalizedPaper,
      });
      if (citationSummary.policy.action === 'manual_review') {
        log.warn(
          { paperId: d.paperId, ratio: citationSummary.policy.unverified_ratio },
          'Citations below confidence threshold — routing to manual review, blocking auto-delivery',
        );
      }
    } catch (cvErr: any) {
      // Verification must never block the pipeline. Flag and continue.
      log.error({ paperId: d.paperId, err: cvErr.message }, 'Citation verification failed; continuing delivery');
    }

    // Step 5: Finalize
    await job.updateProgress(95);
    await supabase.from('papers').update({
      status: 'completed',
      progress_step: 'Completed',
      final_content: finalizedPaper,
      abstract,
      completed_at: new Date().toISOString(),
    }).eq('id', d.paperId);

    await job.updateProgress(100);
    log.info({ paperId: d.paperId }, 'Paper pipeline completed');
    return { paperId: d.paperId, status: 'completed' };

  } catch (error: any) {
    log.error({ paperId: d.paperId, err: error.message }, 'Pipeline failed');
    await supabase.from('papers').update({
      status: 'failed',
      progress_step: `Error: ${error.message}`,
    }).eq('id', d.paperId);
    throw error;
  }
}

let paperWorker: Worker | null = null;

export function startPaperWorker(): Worker | null {
  if (paperWorker) return paperWorker;

  const connection = getRedis();
  if (!connection) {
    log.warn('Redis not configured — paper worker disabled');
    return null;
  }

  paperWorker = new Worker<PaperJobData>('papers', runPipeline, {
    connection: connection as any,
    concurrency: 3,
    limiter: { max: 5, duration: 60000 },
  });

  paperWorker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, 'Paper worker job failed');
  });

  paperWorker.on('ready', () => {
    log.info('Paper worker ready');
  });

  return paperWorker;
}

export async function stopPaperWorker(): Promise<void> {
  if (paperWorker) {
    await paperWorker.close();
    paperWorker = null;
  }
}
