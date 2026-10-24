import api from './api';

export type ShareRole = 'view' | 'comment' | 'edit';
export interface Share { id: string; token: string; role: ShareRole; created_at: string }
export interface VersionSummary { id: string; created_at: string; word_count: number; label: string | null; user_id: string | null }
export interface DocComment {
  id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string;
  anchor_text: string;
  occurrence: number;
  body: string;
  resolved_at: string | null;
  created_at: string;
}
export interface NewComment { body: string; anchorText?: string; occurrence?: number; parentId?: string }

export interface SharedDocument {
  role: ShareRole;
  document: { title: string; content: string; updatedAt: string };
  owner: string;
  comments: DocComment[];
  /** Edit links only: the live document to join. */
  sessionId?: string;
}

/** The owner's version history, share links and comments for one document. */
export const sharingService = {
  versions: (id: string) => api.get<{ versions: VersionSummary[] }>(`/workspace/sessions/${id}/versions`),
  version: (id: string, versionId: string) =>
    api.get<{ version: { id: string; content: string; created_at: string; label: string | null } }>(`/workspace/sessions/${id}/versions/${versionId}`),
  saveVersion: (id: string, label: string) => api.post<{ version: VersionSummary }>(`/workspace/sessions/${id}/versions`, { label }),
  restore: (id: string, versionId: string) => api.post<{ session: { content: string } }>(`/workspace/sessions/${id}/versions/${versionId}/restore`),

  shares: (id: string) => api.get<{ shares: Share[] }>(`/workspace/sessions/${id}/shares`),
  share: (id: string, role: ShareRole) => api.post<{ share: Share }>(`/workspace/sessions/${id}/shares`, { role }),
  /** `collaborative`: an edit link is still on after this one goes. */
  unshare: (id: string, shareId: string) => api.delete<{ ok: true; collaborative: boolean }>(`/workspace/sessions/${id}/shares/${shareId}`),

  comments: (id: string) => api.get<{ comments: DocComment[] }>(`/workspace/sessions/${id}/comments`),
  comment: (id: string, c: NewComment) => api.post<{ comment: DocComment }>(`/workspace/sessions/${id}/comments`, c),
  resolve: (id: string, commentId: string, resolved: boolean) => api.patch(`/workspace/sessions/${id}/comments/${commentId}`, { resolved }),
  removeComment: (id: string, commentId: string) => api.delete(`/workspace/sessions/${id}/comments/${commentId}`),
};

/** For anyone with a share link (no account needed). */
export const sharedService = {
  open: (token: string) => api.get<SharedDocument>(`/shared/${token}`),
  comment: (token: string, c: NewComment & { name: string }) => api.post<{ comment: DocComment }>(`/shared/${token}/comments`, c),
  /** A co-writer's copy of the HTML (signed in, edit links only). */
  save: (token: string, content: string) => api.put(`/shared/${token}/content`, { content }),
};

export const shareUrl = (token: string) => `${window.location.origin}/shared/${token}`;
