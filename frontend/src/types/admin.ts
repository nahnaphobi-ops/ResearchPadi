/** Shapes returned by the /admin API (see backend/src/controllers/admin.controller.ts). */

export interface Paged {
  page: number;
  totalPages: number;
}

export interface AdminOverview {
  totalUsers: number;
  totalRevenue: number;
  todayRevenue: number;
  activeSubscriptions: number;
  activeStandard: number;
  activePremium: number;
  totalPapers: number;
  completedPapers: number;
  processingPapers: number;
  failedTransactions: number;
}

export interface AdminUser {
  id: string;
  phone: string;
  full_name?: string;
  institution_type?: string;
  institution_name?: string;
  programme?: string;
  level?: string;
  created_at: string;
}

export interface AdminTransaction {
  id: string;
  user_id: string;
  type: 'credit' | 'debit';
  amount_ghs: number;
  product?: string;
  status: 'pending' | 'success' | 'failed';
  reference?: string;
  created_at: string;
}

export interface AdminSubscription {
  id: string;
  user_id: string;
  plan: 'standard' | 'premium';
  status: string;
  started_at: string;
  expires_at?: string;
  users?: { full_name?: string };
}

export interface AdminPaper {
  id: string;
  user_id: string;
  title?: string;
  topic?: string;
  status: string;
  actual_word_count?: number;
  target_word_count?: number;
  created_at: string;
}
