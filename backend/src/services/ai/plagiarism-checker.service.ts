import { supabase } from '../../db/supabase.js';
import { generateEmbedding } from '../rag/embedder.service.js';
import { CONFIG } from '../../config/index.js';

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
  sources: Array<{ name: string; url: string; matchCount: number }>;
}

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);
}

function getNGrams(text: string, n: number = 3): string[] {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const ngrams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function calculateNGramSimilarity(text1: string, text2: string): number {
  const ngrams1 = getNGrams(text1);
  const ngrams2 = getNGrams(text2);

  if (ngrams1.length === 0 || ngrams2.length === 0) return 0;

  const set2 = new Set(ngrams2);
  let matches = 0;

  for (const ngram of ngrams1) {
    if (set2.has(ngram)) matches++;
  }

  return matches / Math.max(ngrams1.length, ngrams2.length);
}

function calculateWordOverlap(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const words2 = new Set(text2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));

  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  return overlap / Math.min(words1.size, words2.size);
}

async function findSimilarInKnowledgeBase(
  sentence: string,
  threshold: number = 0.3
): Promise<PlagiarismMatch[]> {
  const matches: PlagiarismMatch[] = [];

  const embedding = await generateEmbedding(sentence);

  if (embedding) {
    const { data: vectorResults } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (vectorResults) {
      for (const result of vectorResults) {
        const similarity = calculateNGramSimilarity(sentence, result.chunk_text);
        if (similarity >= threshold) {
          matches.push({
            originalText: sentence,
            matchedText: result.chunk_text,
            source: result.source_name || 'Knowledge Base',
            sourceUrl: result.source_url || '',
            similarity,
            position: { start: 0, end: sentence.length },
          });
        }
      }
    }
  }

  const { data: textResults } = await supabase
    .from('knowledge_chunks')
    .select('chunk_text, source_name, source_url')
    .or(`chunk_text.ilike.%${sentence.substring(0, 50)}%`)
    .limit(5);

  if (textResults) {
    for (const result of textResults) {
      const existingMatch = matches.some(
        m => m.sourceUrl === result.source_url && m.similarity > 0
      );
      if (!existingMatch) {
        const similarity = calculateWordOverlap(sentence, result.chunk_text);
        if (similarity >= threshold) {
          matches.push({
            originalText: sentence,
            matchedText: result.chunk_text,
            source: result.source_name || 'Knowledge Base',
            sourceUrl: result.source_url || '',
            similarity,
            position: { start: 0, end: sentence.length },
          });
        }
      }
    }
  }

  return matches;
}

export async function checkPlagiarism(text: string): Promise<PlagiarismReport> {
  const sentences = extractSentences(text);
  const words = text.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));

  const allMatches: PlagiarismMatch[] = [];
  const sourceMap = new Map<string, { name: string; url: string; matchCount: number }>();

  for (const sentence of sentences) {
    const matches = await findSimilarInKnowledgeBase(sentence);

    for (const match of matches) {
      allMatches.push(match);

      const existing = sourceMap.get(match.sourceUrl);
      if (existing) {
        existing.matchCount++;
      } else {
        sourceMap.set(match.sourceUrl, {
          name: match.source,
          url: match.sourceUrl,
          matchCount: 1,
        });
      }
    }
  }

  const totalMatchedWords = allMatches.reduce((sum, m) => {
    return sum + m.originalText.split(/\s+/).length;
  }, 0);

  const overallSimilarity = words.length > 0
    ? Math.min(1, totalMatchedWords / words.length)
    : 0;

  return {
    totalWords: words.length,
    uniqueWords: uniqueWords.size,
    matchCount: allMatches.length,
    overallSimilarity: Math.round(overallSimilarity * 100) / 100,
    matches: allMatches.sort((a, b) => b.similarity - a.similarity).slice(0, 50),
    sources: Array.from(sourceMap.values()).sort((a, b) => b.matchCount - a.matchCount),
  };
}
