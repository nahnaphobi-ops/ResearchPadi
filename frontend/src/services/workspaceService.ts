import api from './api';
import type { Source } from '../components/workspace/citations/types';
import { postSse } from '../utils/sse';

export interface StudyDraftSection { heading: string; number: string; text: string }
export interface StudyDraft { paperId: string; title: string; documentType: 'research' | 'care_study'; sections: StudyDraftSection[]; fullText: string }
export type CoachMode = 'guide' | 'feedback';

export const workspaceService = {
  listSessions: () => api.get('/workspace/sessions'),
  createSession: (data: { title?: string; course?: string; institution_type?: string }) =>
    api.post('/workspace/sessions', data),
  getSession: (id: string) => api.get(`/workspace/sessions/${id}`),
  updateSession: (id: string, data: { title?: string; content?: string; course?: string; institution_type?: string; sources_used?: unknown[] }) => api.put(`/workspace/sessions/${id}`, data),
  deleteSession: (id: string) => api.delete(`/workspace/sessions/${id}`),

  // Write your own version of a study draft
  createFromDraft: (paperId: string) => api.post<{ id: string; existing: boolean }>('/workspace/sessions/from-draft', { paperId }),
  getStudyDraft: (id: string) => api.get<StudyDraft>(`/workspace/sessions/${id}/study-draft`),
  coach: async (id: string, body: { mode: CoachMode; heading: string; text?: string }, onDelta: (text: string) => void, signal?: AbortSignal) => {
    await postSse(`/workspace/sessions/${id}/coach`, body, (event, data) => {
      if (event === 'delta') onDelta(String(data.text ?? ''));
    }, signal);
  },
  assist: (data: { selectedText?: string; instruction: string; context?: string; sessionId?: string }) =>
    api.post('/workspace/assist', data),
  searchCitations: (data: { topic: string; query?: string; format?: string }) =>
    api.post('/workspace/citations', data),

  // Advanced assist actions
  assistAdvanced: (data: { action: string; text?: string; fullDocument?: string; sessionId?: string }) =>
    api.post('/workspace/assist-advanced', data),

  // Citation styles
  getCitationStyles: () => api.get('/workspace/citation-styles'),

  // Local RAG citation search
  searchLocalCitations: (data: { query: string; format?: string }) =>
    api.post('/workspace/local-citations', data),

  // Unified source search for inline citations (Ghanaian repositories, OpenAlex, Semantic Scholar)
  findSources: (data: { query: string; ghanaFirst?: boolean; yearFrom?: number; limit?: number }) =>
    api.post<{ sources: Source[] }>('/workspace/sources', data),
};
