import OpenAI from 'openai';
import { CONFIG } from '../../config/index.js';

const getClient = () => {
  if (!CONFIG.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
};

/**
 * Generate text using OpenAI GPT model as a fallback.
 */
export const generateDraft = async (prompt: string, context: any, model?: string): Promise<string> => {
  const client = getClient();
  if (!client) throw new Error('OpenAI API Key missing');

  const response = await client.chat.completions.create({
    model: model || 'gpt-4o',
    max_tokens: 4000,
    messages: [
      { role: 'user', content: `${prompt}\n\nContext: ${JSON.stringify(context)}` }
    ],
  });

  return response.choices[0]?.message?.content || '';
};

/**
 * Supervise/review content using OpenAI GPT model as a fallback.
 */
export const superviseDraft = async (content: string, instructions: string, model?: string): Promise<string> => {
  const client = getClient();
  if (!client) throw new Error('OpenAI API Key missing');

  const response = await client.chat.completions.create({
    model: model || 'gpt-4o',
    max_tokens: 4000,
    messages: [
      { role: 'user', content: `Review and improve the following academic content based on these instructions: ${instructions}\n\nContent:\n${content}` }
    ],
  });

  return response.choices[0]?.message?.content || '';
};
