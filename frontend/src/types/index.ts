export type InstitutionType = 'university' | 'nmtc' | 'technical_university' | 'college_of_education';

export interface User {
  id?: string;
  phone: string;
  // Absent until the user completes their profile (the /register step).
  full_name?: string;
  institution_type?: InstitutionType;
  institution_name?: string;
  programme?: string;
  level?: string;
  created_at?: string;
  // Set by the API when this phone is on the admin list; the API re-checks on every admin call.
  is_admin?: boolean;
  // Approved human reviewer (opens the review desk).
  is_reviewer?: boolean;
}

export interface Paper {
  id: string;
  user_id: string;
  title?: string;
  topic: string;
  course?: string;
  institution_type?: string;
  institution_name?: string;
  programme?: string;
  supervisor_name?: string;
  target_word_count: number;
  actual_word_count?: number;
  status: 'queued' | 'processing' | 'researching' | 'drafting' | 'supervising' | 'completed' | 'failed';
  progress_step?: string;
  chapters: Record<string, string>;
  final_content?: string;
  // When the one included extra supervisor review was used.
  resupervised_at?: string | null;
  abstract?: string;
  sources_used: unknown[];
  document_type?: 'research' | 'care_study';
  // Reference check run before delivery (missing if the check couldn't run).
  citation_status?: 'verified' | 'needs_review' | null;
  citation_report?: CitationReport | null;
  file_url_docx?: string;
  file_url_pdf?: string;
  created_at: string;
  completed_at?: string;
}

/** Summary saved on a paper by the backend's citation verification (verify/types.ts). */
export interface CitationReport {
  total_citations: number;
  verified: number;
  partial_match: number;
  unverified: number;
  results: {
    citation_id: string;
    raw_string: string;
    parsed_title?: string;
    parsed_year?: number;
    match_status: 'verified' | 'partial_match' | 'unverified';
  }[];
}

export interface Wallet {
  id: string;
  user_id: string;
  balance_ghs: number;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'credit' | 'debit';
  amount_ghs: number;
  product?: string;
  reference?: string;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
}

export interface PaperSubmission {
  topic: string;
  course?: string;
  institution_name?: string;
  institution_type?: string;
  programme?: string;
  supervisor_name?: string;
  target_word_count?: number;
}
