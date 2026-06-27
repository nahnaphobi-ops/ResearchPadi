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
  hubtel_reference?: string;
  status: 'pending' | 'success' | 'failed';
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

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'standard' | 'premium';
  status: 'active' | 'expired' | 'cancelled';
  started_at: string;
  expires_at: string;
}

export interface WorkspaceSession {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  course?: string;
  institution_type?: string;
  uploaded_materials: any[];
  sources_used: any[];
  created_at: string;
  updated_at: string;
}

export interface AssignmentSession {
  id: string;
  user_id: string;
  notebook_name: string;
  course: string;
  institution_type?: string;
  uploaded_materials: any[];
  sessions: any[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: string;
  source_name: string;
  source_url?: string;
  document_title: string;
  authors?: string;
  year?: number;
  institution?: string;
  field?: string;
  chunk_text: string;
  chunk_index?: number;
  embedding?: number[];
  created_at: string;
}

export interface HarvestLog {
  id: string;
  source: string;
  records_fetched: number;
  records_added: number;
  status: string;
  error_message?: string;
  harvested_at: string;
}

export interface ResearchResult {
  citations: any[];
  ghanaianSources: KnowledgeChunk[];
  webData: string;
  summary: string;
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
