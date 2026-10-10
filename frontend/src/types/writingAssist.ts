/** Results from the writing-assist endpoints (see backend/src/services/ai/*). */

export interface GrammarIssue {
  type: 'grammar' | 'spelling' | 'style' | 'academic' | 'clarity' | 'citation';
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  original: string;
  suggestion: string;
  position: { start: number; end: number };
  rule: string;
}

export interface GrammarSummary {
  total: number;
  errors: number;
  warnings: number;
  suggestions: number;
  score: number;
}

export interface ClaimSource {
  title: string;
  authors: string;
  institution: string;
  year: number;
  relevantText: string;
  sourceUrl: string;
}

export interface ClaimAnalysis {
  claim: string;
  confidence: 'high' | 'medium' | 'low' | 'unsupported';
  sources: ClaimSource[];
  explanation: string;
  suggestions: string[];
}

export interface PlagiarismMatch {
  originalText: string;
  matchedText: string;
  source: string;
  sourceUrl: string;
  similarity: number;
  position: { start: number; end: number };
}

export interface PlagiarismReport {
  totalWords: number;
  uniqueWords: number;
  matchCount: number;
  overallSimilarity: number;
  matches: PlagiarismMatch[];
  sources: { name: string; url: string; matchCount: number }[];
}

export interface AIIndicator {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface AIDetectionResult {
  isLikelyAI: boolean;
  confidence: number;
  aiScore: number;
  humanScore: number;
  indicators: AIIndicator[];
  recommendation: string;
}
