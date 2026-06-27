import { retrieveContext } from './retriever.service';

export interface ClaimAnalysis {
  claim: string;
  confidence: 'high' | 'medium' | 'low' | 'unsupported';
  sources: ClaimSource[];
  explanation: string;
  suggestions: string[];
}

export interface ClaimSource {
  title: string;
  authors: string;
  institution: string;
  year: number;
  relevantText: string;
  sourceUrl: string;
}

const CLAIM_EXTRACTION_PROMPT = `Extract all factual claims from the following text. Return each claim as a separate line starting with "- ". Focus on:
- Statistical claims (percentages, numbers)
- Causal claims (X causes Y)
- Comparative claims (X is greater than Y)
- Historical claims (events, dates)
- Scientific claims (findings, results)
Text:
`;

export async function extractClaims(text: string): Promise<string[]> {
  const prompt = `${CLAIM_EXTRACTION_PROMPT}\n${text}`;
  const lines = prompt.split('\n');
  const claims: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') && trimmed.length > 20) {
      claims.push(trimmed.substring(2));
    }
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (
      trimmed.length > 30 &&
      !claims.some(c => trimmed.includes(c.substring(0, 30))) &&
      (/\d+%/.test(trimmed) ||
        /\d{4}/.test(trimmed) ||
        /according to/.test(trimmed.toLowerCase()) ||
        /found that/.test(trimmed.toLowerCase()) ||
        /shows? that/.test(trimmed.toLowerCase()) ||
        /indicates? that/.test(trimmed.toLowerCase()) ||
        /suggests? that/.test(trimmed.toLowerCase()))
    ) {
      claims.push(trimmed);
    }
  }

  return [...new Set(claims)].slice(0, 20);
}

export async function validateClaim(claim: string): Promise<ClaimAnalysis> {
  const context = await retrieveContext(claim);
  const sources: ClaimSource[] = (context || []).map((chunk: any) => ({
    title: chunk.document_title || '',
    authors: chunk.authors || '',
    institution: chunk.institution || '',
    year: chunk.year || 0,
    relevantText: chunk.chunk_text || '',
    sourceUrl: chunk.source_url || '',
  }));

  let confidence: ClaimAnalysis['confidence'] = 'unsupported';
  let explanation = '';
  const suggestions: string[] = [];

  if (sources.length === 0) {
    confidence = 'unsupported';
    explanation = 'No relevant sources found in the knowledge base to support this claim.';
    suggestions.push('Consider adding citations to support this claim');
    suggestions.push('Check if the claim is supported by external sources');
  } else {
    const claimLower = claim.toLowerCase();
    let supportingCount = 0;

    for (const source of sources) {
      const sourceText = source.relevantText.toLowerCase();
      const keyTerms = claimLower
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length > 3);

      const matchingTerms = keyTerms.filter(term => sourceText.includes(term));
      if (matchingTerms.length >= Math.ceil(keyTerms.length * 0.4)) {
        supportingCount++;
      }
    }

    if (supportingCount >= 3) {
      confidence = 'high';
      explanation = `${supportingCount} source(s) in the knowledge base appear to support this claim with matching key terms.`;
    } else if (supportingCount >= 1) {
      confidence = 'medium';
      explanation = `${supportingCount} source(s) may support this claim, but verification is recommended.`;
      suggestions.push('Cross-reference with the matched sources directly');
    } else {
      confidence = 'low';
      explanation = 'Sources were found but none strongly support this specific claim.';
      suggestions.push('Verify this claim against primary sources');
      suggestions.push('Consider rephrasing to be more precise');
    }
  }

  if (confidence !== 'high') {
    suggestions.push('Add a citation from a verified academic source');
    suggestions.push('Verify the specific numbers or facts mentioned');
  }

  return { claim, confidence, sources, explanation, suggestions };
}

export async function analyzeDocument(text: string): Promise<ClaimAnalysis[]> {
  const claims = await extractClaims(text);
  const analyses: ClaimAnalysis[] = [];

  for (const claim of claims) {
    const analysis = await validateClaim(claim);
    analyses.push(analysis);
  }

  return analyses;
}
