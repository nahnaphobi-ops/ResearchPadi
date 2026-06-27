import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../../config';

const anthropic = new Anthropic({
  apiKey: CONFIG.ANTHROPIC_API_KEY || '',
});

export const superviseDraft = async (content: string, instructions: string, model?: string) => {
  if (!CONFIG.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API Key missing');
  }

  const response = await anthropic.messages.create({
    model: model || 'claude-3-opus-20240229',
    max_tokens: 4000,
    messages: [
      { 
        role: 'user', 
        content: `Review and improve the following academic content based on these instructions: ${instructions}\n\nContent:\n${content}` 
      }
    ],
  });

  return (response.content[0] as any).text;
};
