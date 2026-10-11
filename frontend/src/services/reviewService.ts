import api from './api';
import adminApi from './adminApi';

export type ReviewStatus = 'pending' | 'in_review' | 'returned' | 'cancelled';
export type ReviewScope = 'excerpt' | 'full';

export interface RubricItem { key: string; label: string }

export interface ReviewComment {
  id: string;
  anchor_text: string;
  occurrence: number;
  comment: string;
  suggestion: string | null;
  status: 'open' | 'accepted' | 'dismissed';
  created_at: string;
}

export interface ReviewSummary {
  id: string;
  session_id: string | null;
  title: string;
  scope: ReviewScope;
  status: ReviewStatus;
  price_ghs: number;
  word_count: number;
  due_at: string | null;
  returned_at: string | null;
  created_at: string;
}

export interface ReviewDetail extends ReviewSummary {
  notes: string | null;
  summary: string | null;
  scores: Record<string, number> | null;
  reviewer_name: string | null;
  comments: ReviewComment[];
  rubric: RubricItem[];
}

export interface DeskItem {
  id: string;
  title: string;
  scope: ReviewScope;
  notes: string | null;
  status: ReviewStatus;
  word_count: number;
  price_ghs: number;
  reviewer_pay_ghs: number;
  institution_type: string | null;
  programme: string | null;
  claimed_at: string | null;
  due_at: string | null;
  returned_at: string | null;
  created_at: string;
}

export interface DeskDetail extends DeskItem {
  content_snapshot: string;
  summary: string | null;
  scores: Record<string, number> | null;
  comments: ReviewComment[];
  rubric: RubricItem[];
}

export interface ReviewPricing { excerpt: number; full: number; turnaroundHours: number; rubric: RubricItem[] }

export const reviewService = {
  pricing: () => api.get<ReviewPricing>('/reviews/pricing'),
  create: (body: { sessionId: string; scope: ReviewScope; excerptHtml?: string; notes?: string }) =>
    api.post<{ request: ReviewSummary }>('/reviews', body),
  listMine: (sessionId?: string) => api.get<{ requests: ReviewSummary[] }>('/reviews', { params: sessionId ? { sessionId } : {} }),
  getMine: (id: string) => api.get<{ request: ReviewDetail }>(`/reviews/${id}`),
  cancel: (id: string) => api.post(`/reviews/${id}/cancel`),
  setCommentStatus: (id: string, commentId: string, status: ReviewComment['status']) =>
    api.patch(`/reviews/${id}/comments/${commentId}`, { status }),
};

export const reviewDeskService = {
  queue: () => api.get<{ open: DeskItem[]; mine: DeskItem[] }>('/review-desk'),
  get: (id: string) => api.get<{ request: DeskDetail }>(`/review-desk/${id}`),
  claim: (id: string) => api.post(`/review-desk/${id}/claim`),
  release: (id: string) => api.post(`/review-desk/${id}/release`),
  addComment: (id: string, body: { anchorText: string; occurrence: number; comment: string; suggestion?: string }) =>
    api.post<{ comment: ReviewComment }>(`/review-desk/${id}/comments`, body),
  deleteComment: (id: string, commentId: string) => api.delete(`/review-desk/${id}/comments/${commentId}`),
  returnReview: (id: string, body: { summary: string; scores: Record<string, number> }) => api.post(`/review-desk/${id}/return`, body),
};

export interface AdminReviewRow {
  id: string;
  title: string;
  scope: ReviewScope;
  status: ReviewStatus;
  price_ghs: number;
  word_count: number;
  reviewer_id: string | null;
  claimed_at: string | null;
  due_at: string | null;
  returned_at: string | null;
  created_at: string;
  user_id: string;
}

export interface AdminReviewer {
  user_id: string;
  display_name: string;
  bio: string | null;
  active: boolean;
  created_at: string;
  users?: { phone?: string } | null;
}

export const adminReviewService = {
  list: (status?: string) =>
    adminApi.get<{ requests: AdminReviewRow[]; reviewers: AdminReviewer[]; reviewerShare: number }>('/admin/reviews', { params: status ? { status } : {} }),
  assign: (id: string, reviewerId: string | null) => adminApi.post(`/admin/reviews/${id}/assign`, { reviewerId }),
  cancel: (id: string) => adminApi.post(`/admin/reviews/${id}/cancel`),
  addReviewer: (body: { phone: string; displayName: string; bio?: string }) => adminApi.post('/admin/reviewers', body),
  setReviewerActive: (userId: string, active: boolean) => adminApi.patch(`/admin/reviewers/${userId}`, { active }),
};

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Waiting for a reviewer',
  in_review: 'In review',
  returned: 'Feedback ready',
  cancelled: 'Cancelled (refunded)',
};
