import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../../config/index.js';

const anthropic = new Anthropic({
  apiKey: CONFIG.ANTHROPIC_API_KEY || '',
});

export const generateDraft = async (prompt: string, context: any, model?: string) => {
  if (!CONFIG.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API Key missing');
  }

  const response = await anthropic.messages.create({
    model: model || 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [
      { role: 'user', content: `${prompt}\n\nContext: ${JSON.stringify(context)}` }
    ],
  });

  return (response.content[0] as any).text;
};
