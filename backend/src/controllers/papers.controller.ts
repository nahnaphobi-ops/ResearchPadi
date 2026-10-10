import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { supervisePaper } from '../services/pipeline/supervise.service.js';
import { humanizePaper } from '../services/pipeline/humanize.service.js';
import { detectAIContent, getDisclosureTemplates, getDisclosureTemplate, suggestDisclosureTemplateId } from '../services/ai/ai-detector.service.js';
import { routeDrafting } from '../services/ai/router.service.js';
import { buildResearchQuestionsPrompt, buildTopicRefinementPrompt } from '../services/ai/prompts.js';
import { generateDocx } from '../services/documents/docx.service.js';
import { paperQueue } from '../lib/queue.js';
import { childLogger } from '../lib/logger.js';
import { CONFIG } from '../config/index.js';
import { debitWallet, paperChargeReference, refundPaperFee } from '../lib/wallet.js';

const log = childLogger('papers-controller');

export const refineTopic = async (req: Request, res: Response) => {
  const { topic, course, institution_type } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  try {
    const prompt = buildTopicRefinementPrompt(topic, course, institution_type);
    const refined = await routeDrafting(prompt, { action: 'refine-topic' });
    res.json({ refined });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const generateResearchQuestions = async (req: Request, res: Response) => {
  const { topic, course, institution_type } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  try {
    const prompt = buildResearchQuestionsPrompt(topic, course, institution_type);
    const questions = await routeDrafting(prompt, { action: 'generate-questions' });
    res.json({ questions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const submitFullPaper = async (req: Request, res: Response) => {
  const { topic, course, institution_name, institution_type, programme, supervisor_name, target_word_count, research_questions } = req.body;
  const userId = (req as any).user?.id;

  if (!topic || !course) {
    return res.status(400).json({ error: 'Topic and Course are required' });
  }

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
    status: 'queued',
    progress_step: 'Queued',
  };
  if (target_word_count) insertData.target_word_count = target_word_count;
  if (research_questions) insertData.research_questions = research_questions;

  const { data: paper, error } = await supabase
    .from('papers')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
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
      target_word_count,
      research_questions,
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

export const downloadPaper = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const disclosureId = String(req.query.disclosureId || '');
  const includeStatement = String(req.query.includeStatement || 'true') !== 'false';

  if (!disclosureId) {
    return res.status(400).json({ error: 'Select an AI disclosure template before downloading' });
  }

  const template = getDisclosureTemplate(disclosureId);
  if (!template) {
    return res.status(400).json({ error: 'Unknown disclosure template' });
  }

  const { data: paper, error } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !paper || !paper.final_content) {
    return res.status(404).json({ error: 'Paper not found or not completed' });
  }

  const generatedAt = new Date().toISOString();
  const docxBuffer = await generateDocx(paper.topic, paper.final_content, {
    paperId: paper.id,
    generatedAt,
    disclosureId: template.id,
    disclosureName: template.name,
    disclosureText: template.content,
    includeStatement,
    toolName: 'ResearchPadi',
    toolVersion: '1.0',
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${paper.topic.replace(/\s+/g, '_')}.docx"`);
  res.setHeader('X-AI-Generated', 'true');
  res.setHeader('X-AI-Disclosure-Id', template.id);
  res.setHeader('X-EU-AI-Act-Article', '50');
  res.send(docxBuffer);
};

export const listDisclosureTemplates = async (req: Request, res: Response) => {
  const { category, institution } = req.query;
  const templates = getDisclosureTemplates(category as string | undefined);
  res.json({
    templates,
    suggestedId: suggestDisclosureTemplateId(institution as string | undefined),
  });
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

  try {
    const revised = await supervisePaper(
      paper.final_content,
      { topic: paper.topic, course: paper.course, institution_type: paper.institution_type, target_word_count: paper.target_word_count },
      paper.sources_used || []
    );

    res.json({
      original: paper.final_content,
      supervised: revised,
      paperId: id
    });
  } catch (err: any) {
    res.status(500).json({ error: `Supervision failed: ${err.message}` });
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

/**
 * GET /api/papers/:id/ai-score
 * Returns an AI-pattern detectability score for the paper's current content.
 * Uses the local heuristic analyser — no external API call required.
 */
export const getAiScore = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  const { data: paper, error } = await supabase
    .from('papers')
    .select('final_content, status, topic')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !paper) {
    return res.status(404).json({ error: 'Paper not found' });
  }

  if (paper.status !== 'completed' || !paper.final_content) {
    return res.status(400).json({ error: 'Paper must be completed before scoring' });
  }

  const result = detectAIContent(paper.final_content);
  res.json(result);
};

/**
 * POST /api/papers/:id/humanize
 * Runs the prose-naturalisation pass on the paper's current content.
 * Returns humanized text + before/after AI scores.
 * Does NOT defeat cryptographic watermarks — improves prose quality only.
 */
export const humanizePaperHandler = async (req: Request, res: Response) => {
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
    return res.status(400).json({ error: 'Paper must be completed before humanizing' });
  }

  try {
    const result = await humanizePaper(paper.final_content, {
      topic: paper.topic,
      course: paper.course,
      institution_type: paper.institution_type,
    });

    res.json({
      humanized: result.humanized,
      beforeScore: result.beforeScore,
      afterScore: result.afterScore,
      paperId: id,
    });
  } catch (err: any) {
    log.error({ paperId: id, err: err.message }, 'Humanize failed');
    res.status(500).json({ error: `Humanize failed: ${err.message}` });
  }
};
