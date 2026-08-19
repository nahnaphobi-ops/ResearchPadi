import { routeDrafting } from '../ai/router.service.js';
import { buildHumanizePrompt } from '../ai/prompts.js';
import { detectAIContent, type AIDetectionResult } from '../ai/ai-detector.service.js';

export interface HumanizeResult {
  humanized: string;
  beforeScore: AIDetectionResult;
  afterScore: AIDetectionResult;
}

/**
 * Naturalizes AI-patterned academic prose by running the humanize prompt
 * through the drafting tier (Sonnet / GPT fallback).
 *
 * This does NOT attempt to defeat cryptographic watermarks — it improves
 * prose quality by removing formulaic AI writing patterns, varying sentence
 * rhythm, and grounding text in Ghanaian academic context.
 */
export const humanizePaper = async (
  text: string,
  paperData: { topic: string; course: string; institution_type: string }
): Promise<HumanizeResult> => {
  const beforeScore = detectAIContent(text);

  const prompt = buildHumanizePrompt(
    text,
    paperData.topic,
    paperData.course,
    paperData.institution_type
  );

  const humanized = await routeDrafting(prompt, { action: 'humanize' });

  const afterScore = detectAIContent(humanized);

  return { humanized, beforeScore, afterScore };
};
