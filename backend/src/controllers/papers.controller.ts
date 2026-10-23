import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { superviseAssembledPaper } from '../services/pipeline/supervise.service.js';
import { formatPlan } from '../services/pipeline/plan.service.js';
import { routeDrafting } from '../services/ai/router.service.js';
import { buildResearchQuestionsPrompt, buildTopicRefinementPrompt } from '../services/ai/prompts.js';
import { generateDocx } from '../services/documents/docx.service.js';
import { paperQueue } from '../lib/queue.js';
import { childLogger } from '../lib/logger.js';
import { CONFIG } from '../config/index.js';
import { debitWallet, paperChargeReference, refundPaperFee } from '../lib/wallet.js';
import { attachmentDisposition } from '../lib/content-disposition.js';
import { auditLog } from '../lib/audit.js';
import { parseCareStudyBrief, type CareStudyBrief } from '../services/pipeline/care-study.service.js';

const log = childLogger('papers-controller');

// Same range as the order form's slider.
const MIN_WORDS = 3000;
const MAX_WORDS = 25000;
// Bump when the study-draft wording on the order form or in the Terms changes.
const STUDY_DRAFT_AGREEMENT_VERSION = '2026-10-23';

// Columns added by later migrations. Until one is applied, PostgREST rejects the
// insert ("could not find the column", PGRST204); retry without them instead of
// failing the order. The job still carries everything the pipeline needs.
const OPTIONAL_PAPER_COLUMNS = ['research_questions', 'document_type', 'brief'];

async function insertPaper(row: Record<string, unknown>) {
  const first = await supabase.from('papers').insert(row).select().single();
  const msg = first.error?.message ?? '';
  if (!first.error || !(first.error.code === 'PGRST204' || /could not find the .*column|column .* does not exist/i.test(msg))) return first;
  log.warn({ err: msg }, 'Paper columns missing (run the latest migrations); saving without them');
  return supabase.from('papers').insert(Object.fromEntries(Object.entries(row).filter(([k]) => !OPTIONAL_PAPER_COLUMNS.includes(k)))).select().single();
}

export const refineTopic = async (req: Request, res: Response) => {
  const { topic, course, institution_type } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  try {
    const prompt = buildTopicRefinementPrompt(topic, course, institution_type);
    const refined = await routeDrafting(prompt, { action: 'refine-topic' }, { tier: 'light', userId: (req as any).user?.id });
    res.json({ refined });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const generateResearchQuestions = async (req: Request, res: Response) => {
  const { topic, course, institution_type } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  try {
    const prompt = buildResearchQuestionsPrompt(topic, course, institution_type);
    const questions = await routeDrafting(prompt, { action: 'generate-questions' }, { tier: 'light', userId: (req as any).user?.id });
    res.json({ questions });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const submitFullPaper = async (req: Request, res: Response) => {
  const { institution_name, institution_type, programme, supervisor_name, research_questions, usage_agreed } = req.body;
  const userId = (req as any).user?.id;

  const isCareStudy = req.body.document_type === 'care_study';
  let careStudy: CareStudyBrief | undefined;
  if (isCareStudy) {
    const parsed = parseCareStudyBrief(req.body.care_study);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    careStudy = parsed.brief;
  }
  const topic = careStudy ? `Maternity care study: ${careStudy.caseFocus}` : req.body.topic;
  const course = careStudy ? req.body.course || 'Midwifery' : req.body.course;

  if (!topic || !course) {
    return res.status(400).json({ error: 'Topic and Course are required' });
  }
  // The student confirms, before paying, that a study draft is for studying from
  // and not for submitting as their own work. Recorded in the audit log below.
  if (usage_agreed !== true) {
    return res.status(400).json({ error: 'Please confirm how you will use the study draft before ordering.' });
  }

  const requestedWords = Number(req.body.target_word_count);
  const target_word_count = Number.isFinite(requestedWords) && requestedWords > 0
    ? Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(requestedWords)))
    : undefined;

  // Never charge for a paper we can't generate.
  if (!paperQueue) {
    log.warn('Full paper requested but the generation queue is unavailable');
    return res.status(503).json({ error: 'Paper generation is temporarily unavailable. You have not been charged — please try again shortly.' });
  }

  const fee = CONFIG.PRICING.FULL_PAPER_GHS;

  const insertData: Record<string, any> = {
    user_id: userId,
    topic,
    course,
    institution_name,
    institution_type,
    programme,
    supervisor_name,
    // 'processing', not 'queued': the papers.status CHECK in the initial schema
    // never allowed 'queued', so inserting it is rejected by the database.
    status: 'processing',
    progress_step: 'Queued',
  };
  if (target_word_count && !careStudy) insertData.target_word_count = target_word_count;
  if (research_questions && !careStudy) insertData.research_questions = research_questions;
  if (careStudy) {
    insertData.document_type = 'care_study';
    insertData.brief = { care_study: careStudy };
  }

  const { data: paper, error } = await insertPaper(insertData);

  if (error) {
    log.error({ err: error.message }, 'Could not save the paper order');
    return res.status(500).json({ error: 'Could not create your order. You have not been charged. Please try again.' });
  }

  // Charge the wallet, tied to this paper so a later refund can find it.
  const charge = await debitWallet(userId, fee, 'full_paper', paperChargeReference(paper.id));
  if (!charge.ok) {
    await supabase.from('papers').delete().eq('id', paper.id);
    if (charge.reason === 'insufficient_funds') {
      return res.status(402).json({ error: `Insufficient balance. A full paper costs GHS ${fee}. Please top up your wallet.` });
    }
    return res.status(500).json({ error: 'Could not process payment. You have not been charged.' });
  }

  let jobId: string | undefined;
  try {
    const job = await paperQueue.add('generate-paper', {
      paperId: paper.id,
      topic,
      course,
      institution_name,
      institution_type,
      programme,
      supervisor_name,
      target_word_count: careStudy ? undefined : target_word_count,
      research_questions: careStudy ? undefined : research_questions,
      document_type: careStudy ? 'care_study' : 'research',
      care_study: careStudy,
    });
    jobId = job.id;
    log.info({ paperId: paper.id, jobId: job.id }, 'Paper job enqueued');
  } catch (err: any) {
    log.error({ paperId: paper.id, err: err.message }, 'Failed to enqueue paper; refunding');
    const refund = await refundPaperFee(paper.id);
    await supabase.from('papers').update({
      status: 'failed',
      progress_step: refund === 'refunded' ? `Could not start generation. GHS ${fee} refunded to your wallet.` : 'Could not start generation.',
    }).eq('id', paper.id);
    return res.status(500).json({ error: `Could not start generation. GHS ${fee} has been refunded to your wallet.` });
  }

  await auditLog({
    event: 'PAPER_CREATED',
    actorId: userId,
    targetType: 'paper',
    targetId: paper.id,
    metadata: { product: careStudy ? 'care_study_draft' : 'study_draft', fee, usage_agreed: true, agreement_version: STUDY_DRAFT_AGREEMENT_VERSION },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ message: 'Paper submission successful', paperId: paper.id, jobId, balance: charge.balance });
};

export const getJobStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const { data: paper, error } = await supabase
    .from('papers')
    .select('id, status, progress_step, created_at, completed_at')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !paper) {
    return res.status(404).json({ error: 'Paper not found' });
  }

  res.json(paper);
};

export const listPapers = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { data, error } = await supabase
    .from('papers')
    .select('id, title, topic, course, institution_name, status, progress_step, created_at, completed_at, file_url_docx, file_url_pdf')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

export const getPaperDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Paper not found' });
  res.json(data);
};

/** The .docx always carries the study-draft notice (top box, page header, closing statement). */
export const downloadPaper = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  const { data: paper, error } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !paper || !paper.final_content) {
    return res.status(404).json({ error: 'Paper not found or not completed' });
  }

  const docxBuffer = await generateDocx(paper.topic, paper.final_content, {
    paperId: paper.id,
    generatedAt: new Date().toISOString(),
    toolName: 'ResearchPadi',
    toolVersion: '1.0',
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', attachmentDisposition(`${paper.topic} - study draft`, '.docx'));
  res.setHeader('X-AI-Generated', 'true');
  res.setHeader('X-EU-AI-Act-Article', '50');
  res.send(docxBuffer);
};

export const superviseCompletedPaper = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  const { data: paper, error } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !paper) {
    return res.status(404).json({ error: 'Paper not found' });
  }

  if (paper.status !== 'completed' || !paper.final_content) {
    return res.status(400).json({ error: 'Paper must be completed first' });
  }
  if (paper.document_type === 'care_study') {
    // Research supervision rules don't fit a care study, which was already
    // reviewed and checked against its case record while it was written.
    return res.status(400).json({ error: 'Care studies are reviewed and checked against their case record while they are written.' });
  }

  // One extra supervisor review per paper is included in the price (each costs
  // about as much as the original review). Claim it atomically so a double
  // click can't start two.
  const { data: claimed, error: claimError } = await supabase
    .from('papers')
    .update({ resupervised_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('resupervised_at', null)
    .select('id')
    .maybeSingle();

  if (claimError) {
    log.error({ paperId: id, err: claimError.message }, 'Could not claim the extra review');
    return res.status(500).json({ error: 'Could not start the review. Please try again.' });
  }
  if (!claimed) {
    return res.status(409).json({ error: 'This paper has already had its extra supervisor review.' });
  }

  try {
    const revised = await superviseAssembledPaper(
      paper.final_content,
      { topic: paper.topic, course: paper.course, institution_type: paper.institution_type, target_word_count: paper.target_word_count },
      paper.sources_used || [],
      paper.brief?.plan ? formatPlan(paper.brief.plan) : undefined
    );

    res.json({
      original: paper.final_content,
      supervised: revised,
      paperId: id
    });
  } catch (err: any) {
    // Give the review back if it didn't run.
    await supabase.from('papers').update({ resupervised_at: null }).eq('id', id).eq('user_id', userId);
    res.status(err.status || 500).json({ error: `Supervision failed: ${err.message}` });
  }
};

export const acceptSupervision = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  const { data: paper, error } = await supabase
    .from('papers')
    .select('final_content')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !paper) {
    return res.status(404).json({ error: 'Paper not found' });
  }

  const { supervised } = req.body;
  if (!supervised) {
    return res.status(400).json({ error: 'Supervised content is required in request body' });
  }

  await supabase.from('papers').update({
    final_content: supervised
  }).eq('id', id).eq('user_id', userId);

  res.json({ message: 'Supervised version accepted' });
};

export const deletePaper = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const { data, error } = await supabase
    .from('papers')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Failed to delete paper' });
  if (!data) return res.status(404).json({ error: 'Paper not found' });
  res.json({ message: 'Paper deleted' });
};
