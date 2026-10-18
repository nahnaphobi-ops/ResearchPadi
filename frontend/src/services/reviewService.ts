import api from './api';
import adminApi from './adminApi';

export type ReviewStatus = 'pending' | 'in_review' | 'returned' | 'cancelled';
export type ReviewScope = 'excerpt' | 'full';
export type ReviewSourceType = 'workspace' | 'paper' | 'care_study';

export const SOURCE_LABEL: Record<ReviewSourceType, string> = {
  workspace: 'Document',
  paper: 'Full paper',
  care_study: 'Care study',
};

export interface Specialty { key: string; label: string }
export interface ReviewPart { key: string; label: string; words: number }

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
  source_type: ReviewSourceType;
  source_id: string | null;
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
  /** Papers and care studies are shown from the snapshot the reviewer saw. */
  content_snapshot: string | null;
  reviewer_name: string | null;
  comments: ReviewComment[];
  rubric: RubricItem[];
}

export interface DeskItem {
  id: string;
  title: string;
  source_type: ReviewSourceType;
  specialty: string | null;
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

export interface ReviewPricing { excerpt: number; full: number; turnaroundHours: number; rubric: RubricItem[]; specialties: Specialty[] }

export const reviewService = {
  pricing: () => api.get<ReviewPricing>('/reviews/pricing'),
  create: (body: {
    sourceType?: ReviewSourceType;
    /** Workspace document. */
    sessionId?: string;
    /** Paper or care study. */
    sourceId?: string;
    scope: ReviewScope;
    excerptHtml?: string;
    /** A paper's chapter number or a care study's section key. */
    part?: string;
    notes?: string;
  }) => api.post<{ request: ReviewSummary }>('/reviews', body),
  sourceOptions: (sourceType: ReviewSourceType, sourceId: string) =>
    api.get<{ title: string; parts: ReviewPart[] }>('/reviews/source-options', { params: { sourceType, sourceId } }),
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
  source_type: ReviewSourceType;
  specialty: string | null;
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
  specialties: string[];
  institution: string | null;
  qualification: string | null;
  years_experience: number | null;
  vetted_at: string | null;
  vetting_notes: string | null;
  users?: { phone?: string } | null;
}

export const adminReviewService = {
  list: (status?: string) =>
    adminApi.get<{ requests: AdminReviewRow[]; reviewers: AdminReviewer[]; reviewerShare: number }>('/admin/reviews', { params: status ? { status } : {} }),
  assign: (id: string, reviewerId: string | null) => adminApi.post(`/admin/reviews/${id}/assign`, { reviewerId }),
  cancel: (id: string) => adminApi.post(`/admin/reviews/${id}/cancel`),
  addReviewer: (body: { phone: string; displayName: string; bio?: string; specialties?: string[] }) => adminApi.post('/admin/reviewers', body),
  setSpecialties: (userId: string, specialties: string[]) => adminApi.patch(`/admin/reviewers/${userId}/specialties`, { specialties }),
  setReviewerActive: (userId: string, active: boolean) => adminApi.patch(`/admin/reviewers/${userId}`, { active }),
};

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Waiting for a reviewer',
  in_review: 'In review',
  returned: 'Feedback ready',
  cancelled: 'Cancelled (refunded)',
};

export interface ReviewerApplication {
  id: string;
  display_name: string;
  institution: string;
  qualification: string;
  specialties: string[];
  years_experience: number;
  bio: string | null;
  profile_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface AdminApplication extends ReviewerApplication {
  user_id: string;
  users?: { phone?: string; full_name?: string } | null;
}

export interface ApplicationForm {
  display_name: string;
  institution: string;
  qualification: string;
  specialties: string[];
  years_experience: number;
  bio: string;
  profile_url: string;
  declaration: boolean;
}

export const reviewerApplicationService = {
  mine: () => api.get<{ application: ReviewerApplication | null; isReviewer: boolean; specialties: Specialty[] }>('/reviewer-applications/mine'),
  apply: (body: ApplicationForm) => api.post('/reviewer-applications', body),
};

export const adminApplicationService = {
  list: (status?: string) =>
    adminApi.get<{ applications: AdminApplication[]; specialties: Specialty[] }>('/admin/reviewer-applications', { params: status ? { status } : {} }),
  approve: (id: string, body: { notes?: string; specialties?: string[] }) => adminApi.post(`/admin/reviewer-applications/${id}/approve`, body),
  reject: (id: string, notes: string) => adminApi.post(`/admin/reviewer-applications/${id}/reject`, { notes }),
};
