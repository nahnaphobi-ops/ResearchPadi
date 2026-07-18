export type MatchStatus = 'verified' | 'partial_match' | 'unverified';
export type MatchSource = 'rag' | 'openalex' | 'semantic_scholar' | 'none' | 'api_unavailable';

export type ExtractionMethod = 'regex' | 'llm_assisted';

export interface Candidate {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  source: 'rag' | 'openalex' | 'semantic_scholar';
}

export interface ParsedAuthor {
  raw: string;
  surname: string;
  given?: string;
}

export interface ParsedCitation {
  id: string;
  authors: ParsedAuthor[];
  year?: number;
  title?: string;
  publisher?: string;
  doi?: string;
  url?: string;
  raw_string: string;
  source_location: 'in_text' | 'reference_list';
  extraction_method: ExtractionMethod;
}

export interface InTextCitation extends ParsedCitation {
  source_location: 'in_text';
}

export interface ReferenceEntry extends ParsedCitation {
  source_location: 'reference_list';
}

export interface VerificationResult {
  citation_id: string;
  raw_string: string;
  parsed_authors: string[];
  parsed_year?: number;
  parsed_title?: string;
  match_status: MatchStatus;
  matched_source: MatchSource;
  matched_record_id?: string;
  confidence_score: number;
  checked_at: string;
}

export interface CrossConsistencyResult {
  orphan_in_text: string[];
  unused_references: string[];
}

export interface VerificationSummary {
  paper_id: string;
  total_citations: number;
  verified: number;
  partial_match: number;
  unverified: number;
  orphan_in_text: string[];
  unused_references: string[];
  results: VerificationResult[];
  policy: {
    action: 'deliver' | 'manual_review';
    unverified_ratio: number;
    block_ratio_threshold: number;
  };
  ran_at: string;
}
