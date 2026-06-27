export interface User {
  id: string;
  phone: string;
  full_name: string;
  institution_type: 'university' | 'nmtc' | 'technical_university' | 'college_of_education';
  institution_name: string;
  programme?: string;
  level?: string;
  created_at: string;
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
  status: 'processing' | 'researching' | 'drafting' | 'supervising' | 'completed' | 'failed';
  progress_step?: string;
  chapters: Record<string, string>;
  final_content?: string;
  abstract?: string;
  sources_used: any[];
  file_url_docx?: string;
  file_url_pdf?: string;
  created_at: string;
  completed_at?: string;
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
