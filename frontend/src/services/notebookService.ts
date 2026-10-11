import api from './api';
import { postSse } from '../utils/sse';

export type NotebookSourceKind = 'pdf' | 'docx' | 'txt' | 'url' | 'text';

export interface NotebookSource {
  id: string;
  title: string;
  kind: NotebookSourceKind;
  url: string | null;
  authors: string | null;
  year: number | null;
  char_count: number;
  chunk_count: number;
  created_at: string;
}

/** A numbered source behind an answer; [n] in the answer refers to it. */
export interface NotebookCitation {
  n: number;
  sourceId: string;
  title: string;
  authors: string | null;
  year: number | null;
  url: string | null;
  kind: NotebookSourceKind;
  snippet: string;
}

export type NotebookOutput = 'summary' | 'matrix' | 'questions' | 'faq' | 'study-guide';

const base = (sessionId: string) => `/workspace/sessions/${sessionId}/notebook`;

export const notebookService = {
  list: (sessionId: string) => api.get<{ sources: NotebookSource[] }>(base(sessionId)),
  addFile: (sessionId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ source: NotebookSource }>(`${base(sessionId)}/sources`, form);
  },
  addUrl: (sessionId: string, url: string) => api.post<{ source: NotebookSource }>(`${base(sessionId)}/sources`, { url }),
  addText: (sessionId: string, title: string, text: string) =>
    api.post<{ source: NotebookSource }>(`${base(sessionId)}/sources`, { title, text }),
  update: (sessionId: string, sourceId: string, patch: { title?: string; authors?: string; year?: number | null }) =>
    api.patch<{ source: NotebookSource }>(`${base(sessionId)}/sources/${sourceId}`, patch),
  remove: (sessionId: string, sourceId: string) => api.delete(`${base(sessionId)}/sources/${sourceId}`),

  /** Stream an answer; `onSources` fires once, before the first text. */
  stream: async (
    sessionId: string,
    request: { type: 'chat'; question: string; history: { role: 'user' | 'assistant'; content: string }[] } | { type: 'generate'; kind: NotebookOutput },
    handlers: { onSources: (sources: NotebookCitation[]) => void; onDelta: (text: string) => void },
    signal?: AbortSignal,
  ) => {
    const path = request.type === 'chat' ? `${base(sessionId)}/chat` : `${base(sessionId)}/generate`;
    const body = request.type === 'chat' ? { question: request.question, history: request.history } : { kind: request.kind };
    let truncated = false;
    await postSse(path, body, (event, data) => {
      if (event === 'sources') handlers.onSources((data.sources as NotebookCitation[] | undefined) ?? []);
      else if (event === 'delta') handlers.onDelta(String(data.text ?? ''));
      else if (event === 'done') truncated = Boolean(data.truncated);
    }, signal);
    return { truncated };
  },
};
