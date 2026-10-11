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

export class InlineAIError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * POST /workspace/inline-ai and read its Server-Sent Events. axios can't stream
 * response bodies in the browser, so this uses fetch with the same token.
 */
export async function streamInlineAI(
  body: InlineRequest,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<{ truncated: boolean }> {
  const base = import.meta.env.VITE_API_URL || '/api';
  const token = localStorage.getItem('token');
  const res = await fetch(`${base}/workspace/inline-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let data: { error?: string; code?: string } = {};
    try { data = await res.json(); } catch { /* not JSON */ }
    throw new InlineAIError(data.error || 'The AI request failed. Please try again.', res.status, data.code);
  }
  if (!res.body) throw new InlineAIError('Streaming is not supported in this browser.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      const payload = data ? JSON.parse(data) : {};
      if (event === 'delta') onDelta(payload.text || '');
      else if (event === 'done') truncated = Boolean(payload.truncated);
      else if (event === 'error') throw new InlineAIError(payload.error || 'The AI stopped unexpectedly.', payload.status);
    }
  }
  return { truncated };
}
