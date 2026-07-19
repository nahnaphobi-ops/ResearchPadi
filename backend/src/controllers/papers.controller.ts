import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { supervisePaper } from '../services/pipeline/supervise.service.js';
import { routeDrafting } from '../services/ai/router.service.js';
import { buildResearchQuestionsPrompt, buildTopicRefinementPrompt } from '../services/ai/prompts.js';
import { generateDocx } from '../services/documents/docx.service.js';
import { paperQueue } from '../lib/queue.js';
import { childLogger } from '../lib/logger.js';

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

  let jobId: string | undefined;
  if (!paperQueue) {
    log.warn({ paperId: paper.id }, 'Redis not configured — paper generation queue disabled');
  } else {
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
  }

  await supabase.from('papers').update({ progress_step: 'Queued' }).eq('id', paper.id);

  res.json({ message: 'Paper submission successful', paperId: paper.id, jobId });
};

export const getJobStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data: paper, error } = await supabase
    .from('papers')
    .select('id, status, progress_step, created_at, completed_at')
    .eq('id', id)
    .single();

  if (error || !paper) {
    return res.status(404).json({ error: 'Paper not found' });
  }

  res.json(paper);
};

export const listPapers = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { data, error } = await supabase.from('papers').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

export const getPaperDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('papers').select('*').eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

export const downloadPaper = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data: paper, error } = await supabase.from('papers').select('*').eq('id', id).single();

  if (error || !paper || !paper.final_content) {
    return res.status(404).json({ error: 'Paper not found or not completed' });
  }

  const docxBuffer = await generateDocx(paper.topic, paper.final_content);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${paper.topic.replace(/\s+/g, '_')}.docx"`);
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
  }).eq('id', id);

  res.json({ message: 'Supervised version accepted' });
};

export const deletePaper = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { error } = await supabase.from('papers').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Paper deleted' });
};
