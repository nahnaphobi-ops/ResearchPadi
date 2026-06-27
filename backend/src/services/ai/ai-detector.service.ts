export interface AIDetectionResult {
  isLikelyAI: boolean;
  confidence: number;
  aiScore: number;
  humanScore: number;
  indicators: AIIndicator[];
  recommendation: string;
}

export interface AIIndicator {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface DisclosureTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  journal?: string;
}

const DISCLOSURE_TEMPLATES: DisclosureTemplate[] = [
  {
    id: 'apa-ai-general',
    name: 'General AI Disclosure (APA Style)',
    category: 'APA',
    content: 'Artificial intelligence tools were used to assist with drafting and editing this manuscript. All content was reviewed, verified, and approved by the authors.',
  },
  {
    id: 'apa-ai-writing',
    name: 'AI Writing Assistance Disclosure',
    category: 'APA',
    content: 'AI writing assistants (e.g., ChatGPT, Claude) were used for language refinement and initial drafting. The authors take full responsibility for the content, accuracy, and originality of this work.',
  },
  {
    id: 'apa-ai-grammar',
    name: 'AI Grammar Checking Disclosure',
    category: 'APA',
    content: 'AI-powered grammar and style checking tools were used to proofread this manuscript. No AI tool was used to generate substantive content.',
  },
  {
    id: 'vancouver-ai',
    name: 'Vancouver Style AI Disclosure',
    category: 'Vancouver',
    content: 'AI language models were employed for text editing purposes. Authors reviewed and validated all generated content.',
  },
  {
    id: 'chicago-ai',
    name: 'Chicago Style AI Disclosure',
    category: 'Chicago',
    content: 'The authors acknowledge the use of artificial intelligence tools for language polishing and drafting assistance. All claims, analyses, and conclusions are the original work of the authors.',
  },
  {
    id: 'harvard-ai',
    name: 'Harvard Style AI Disclosure',
    category: 'Harvard',
    content: 'AI-assisted writing tools were utilised in the preparation of this manuscript. The authors have critically reviewed and approved the final version.',
  },
  {
    id: 'ieee-ai',
    name: 'IEEE Style AI Disclosure',
    category: 'IEEE',
    content: 'AI language tools were used for manuscript preparation. The authors confirm that all content has been reviewed for accuracy and originality.',
  },
  {
    id: 'ghanau-apa',
    name: 'Ghana University APA Disclosure',
    category: 'Ghana APA',
    content: 'AI writing assistance tools were used in drafting this paper in accordance with institutional guidelines. The authors retain full responsibility for the intellectual content.',
  },
  {
    id: 'knust-standard',
    name: 'KNUST Standard Disclosure',
    category: 'KNUST',
    content: 'This manuscript was prepared with the assistance of AI language tools for editing and proofreading. The research, analysis, and conclusions are entirely the work of the named authors.',
  },
  {
    id: 'ug-standard',
    name: 'University of Ghana Standard Disclosure',
    category: 'UG',
    content: 'Artificial intelligence tools were used for language editing and initial drafting. All authors have reviewed and approved the manuscript and take full responsibility for its content.',
  },
];

const AI_PATTERNS = {
  repetitiveStructure: /\b(furthermore|moreover|additionally|consequently|in conclusion|it is important to note|it is worth noting|in summary|to summarize)\b/gi,
  genericHedging: /\b(it is possible|it is likely|it may be|it could be|it seems|it appears|it suggests)\b/gi,
  formalPhrasing: /\b(in this regard|in this context|with regard to|in terms of|as regards|with respect to|in light of|it should be noted)\b/gi,
  transitionOveruse: /\b(however|therefore|thus|hence|consequently|accordingly|nevertheless|nonetheless|on the other hand|in contrast|conversely)\b/gi,
  listPatterns: /\b:firstly|secondly|thirdly|lastly|in addition|also|furthermore|moreover\b/gi,
  sentenceStarters: /\b(the (purpose|aim|objective|goal) of|this (paper|study|research|article)|the (results|findings|data) (show|indicate|suggest|reveal|demonstrate))\b/gi,
  hedgingFrequency: /\b(may|might|could|would|should|must|shall|can|likely|unlikely|possibly|perhaps|probably|arguably)\b/gi,
};

function analyzeTextPatterns(text: string): { type: string; count: number; severity: 'high' | 'medium' | 'low' }[] {
  const indicators: { type: string; count: number; severity: 'high' | 'medium' | 'low' }[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = text.split(/\s+/).length / Math.max(sentences.length, 1);

  let repetitiveCount = 0;
  let match;
  while ((match = AI_PATTERNS.repetitiveStructure.exec(text)) !== null) repetitiveCount++;
  if (repetitiveCount > 3) {
    indicators.push({
      type: 'Repetitive Transitions',
      count: repetitiveCount,
      severity: repetitiveCount > 6 ? 'high' : 'medium',
    });
  }

  let hedgingCount = 0;
  while ((match = AI_PATTERNS.genericHedging.exec(text)) !== null) hedgingCount++;
  if (hedgingCount > 5) {
    indicators.push({
      type: 'Excessive Hedging',
      count: hedgingCount,
      severity: hedgingCount > 8 ? 'high' : 'medium',
    });
  }

  let formalCount = 0;
  while ((match = AI_PATTERNS.formalPhrasing.exec(text)) !== null) formalCount++;
  if (formalCount > 4) {
    indicators.push({
      type: 'Generic Formal Phrasing',
      count: formalCount,
      severity: formalCount > 7 ? 'high' : 'medium',
    });
  }

  let transitionCount = 0;
  while ((match = AI_PATTERNS.transitionOveruse.exec(text)) !== null) transitionCount++;
  if (transitionCount > 8) {
    indicators.push({
      type: 'Transition Overuse',
      count: transitionCount,
      severity: transitionCount > 12 ? 'high' : 'medium',
    });
  }

  let sentenceStarters = 0;
  while ((match = AI_PATTERNS.sentenceStarters.exec(text)) !== null) sentenceStarters++;
  if (sentenceStarters > 3) {
    indicators.push({
      type: 'Formulaic Sentence Starters',
      count: sentenceStarters,
      severity: sentenceStarters > 5 ? 'high' : 'medium',
    });
  }

  if (avgSentenceLength > 30) {
    indicators.push({
      type: 'Unnaturally Long Sentences',
      count: Math.round(avgSentenceLength),
      severity: avgSentenceLength > 40 ? 'high' : 'medium',
    });
  }

  const wordCount = text.split(/\s+/).length;
  const uniqueWords = new Set(text.toLowerCase().split(/\s+/));
  const lexicalDiversity = uniqueWords.size / Math.max(wordCount, 1);

  if (lexicalDiversity < 0.4) {
    indicators.push({
      type: 'Low Lexical Diversity',
      count: Math.round(lexicalDiversity * 100),
      severity: lexicalDiversity < 0.3 ? 'high' : 'medium',
    });
  }

  return indicators;
}

export function detectAIContent(text: string): AIDetectionResult {
  const indicators = analyzeTextPatterns(text);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = text.split(/\s+/).length;

  let aiScore = 0;
  const maxScore = indicators.length * 10;

  for (const indicator of indicators) {
    switch (indicator.severity) {
      case 'high': aiScore += 10; break;
      case 'medium': aiScore += 6; break;
      case 'low': aiScore += 3; break;
    }
  }

  if (wordCount < 50) aiScore += 5;
  if (wordCount > 500) aiScore += Math.min(indicators.length * 2, 10);

  const normalizedScore = maxScore > 0 ? (aiScore / maxScore) * 100 : 0;
  const humanScore = 100 - normalizedScore;

  let recommendation = '';
  if (normalizedScore > 70) {
    recommendation = 'High likelihood of AI-generated content. Consider significant revision to add original voice and analysis.';
  } else if (normalizedScore > 50) {
    recommendation = 'Moderate AI indicators detected. Review flagged areas and add more specific, personal analysis.';
  } else if (normalizedScore > 30) {
    recommendation = 'Some AI patterns detected. Minor revisions recommended to improve originality.';
  } else {
    recommendation = 'Content appears predominantly human-written with minimal AI indicators.';
  }

  return {
    isLikelyAI: normalizedScore > 50,
    confidence: Math.min(95, Math.max(40, normalizedScore + 20)),
    aiScore: Math.round(normalizedScore),
    humanScore: Math.round(humanScore),
    indicators: indicators.map(i => ({
      type: i.type,
      description: `${i.type}: Found ${i.count} instances with ${i.severity} severity`,
      severity: i.severity,
      evidence: `Detected ${i.count} occurrences`,
    })),
    recommendation,
  };
}

export function getDisclosureTemplates(category?: string): DisclosureTemplate[] {
  if (category) {
    return DISCLOSURE_TEMPLATES.filter(t => t.category.toLowerCase() === category.toLowerCase());
  }
  return DISCLOSURE_TEMPLATES;
}

export function getDisclosureTemplate(id: string): DisclosureTemplate | undefined {
  return DISCLOSURE_TEMPLATES.find(t => t.id === id);
}
