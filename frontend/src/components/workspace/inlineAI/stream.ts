import { postSse, StreamError } from '../../../utils/sse';

export type InlineAction =
  | 'improve' | 'shorten' | 'expand' | 'grammar' | 'academic' | 'simplify' | 'summarise'
  | 'continue' | 'draft' | 'table' | 'brainstorm' | 'summarise-above' | 'ask' | 'refine';

export interface InlineRequest {
  action: InlineAction;
  text?: string;
  before?: string;
  after?: string;
  prompt?: string;
  previous?: string;
  title?: string;
}

export { StreamError as InlineAIError };

/** Stream an inline-AI answer from POST /workspace/inline-ai. */
export async function streamInlineAI(
  body: InlineRequest,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<{ truncated: boolean }> {
  let truncated = false;
  await postSse('/workspace/inline-ai', body, (event, data) => {
    if (event === 'delta') onDelta(String(data.text ?? ''));
    else if (event === 'done') truncated = Boolean(data.truncated);
  }, signal);
  return { truncated };
}
