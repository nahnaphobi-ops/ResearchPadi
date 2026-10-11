export class StreamError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * POST JSON to the API and read the Server-Sent Events it streams back. axios
 * can't stream response bodies in the browser, so this uses fetch with the same
 * token. `error` events and non-2xx responses throw StreamError.
 */
export async function postSse(
  path: string,
  body: unknown,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const base = import.meta.env.VITE_API_URL || '/api';
  const token = localStorage.getItem('token');
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let data: { error?: string; code?: string } = {};
    try { data = await res.json(); } catch { /* not JSON */ }
    throw new StreamError(data.error || 'The request failed. Please try again.', res.status, data.code);
  }
  if (!res.body) throw new StreamError('Streaming is not supported in this browser.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
      const payload = (data ? JSON.parse(data) : {}) as Record<string, unknown>;
      if (event === 'error') throw new StreamError(String(payload.error || 'The stream stopped unexpectedly.'), Number(payload.status) || undefined);
      onEvent(event, payload);
    }
  }
}
