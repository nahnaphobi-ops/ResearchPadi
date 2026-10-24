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

// Phrases and vocabulary that AI models overuse.
const STOCK_PHRASES = /\b(furthermore|moreover|additionally|in conclusion|it is important to note|it is worth noting|in summary|to summarize|delves? into|underscores?|pivotal|paramount|multifaceted|nuanced|sheds? light on|in the realm of|tapestry|embarks? on|plays? a (?:crucial|vital|pivotal) role|in today's (?:world|society))\b/gi;
const GENERIC_HEDGING = /\b(it is possible|it is likely|it may be|it could be|it seems|it appears|it suggests)\b/gi;
const FORMAL_FILLER = /\b(in this regard|in this context|with regard to|in terms of|as regards|with respect to|in light of|it should be noted)\b/gi;
const TRANSITIONS = /\b(however|therefore|thus|hence|consequently|accordingly|nevertheless|nonetheless|on the other hand|in contrast|conversely)\b/gi;
const FORMULAIC_START = /^(the (purpose|aim|objective|goal) of|this (paper|study|research|article)|the (results|findings|data) (show|indicate|suggest|reveal|demonstrate))\b/i;

// Below this many words there is too little text to call it either way.
export const MIN_WORDS_TO_JUDGE = 150;
const VOCABULARY_WINDOW = 50;

/** One pattern, how strongly it shows (0 to 1) and how much it counts towards the score. */
interface Signal {
  type: string;
  weight: number;
  strength: number;
  evidence: string;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function found(text: string, pattern: RegExp): string[] {
  return (text.match(pattern) ?? []).map(m => m.toLowerCase());
}

function phraseEvidence(phrases: string[]): string {
  const examples = [...new Set(phrases)].slice(0, 4).map(p => `"${p}"`).join(', ');
  return `Found ${phrases.length}: ${examples}`;
}

/**
 * Average share of distinct words in each 50-word stretch. A whole-text ratio
 * falls as any text gets longer; this one does not, so long theses are not
 * penalised for their length.
 */
function vocabularyVariety(words: string[]): number {
  const counts = new Map<string, number>();
  const add = (w: string) => counts.set(w, (counts.get(w) ?? 0) + 1);
  const remove = (w: string) => {
    const n = (counts.get(w) ?? 0) - 1;
    if (n > 0) counts.set(w, n);
    else counts.delete(w);
  };
  words.slice(0, VOCABULARY_WINDOW).forEach(add);
  let total = counts.size;
  for (let i = VOCABULARY_WINDOW; i < words.length; i++) {
    add(words[i]);
    remove(words[i - VOCABULARY_WINDOW]);
    total += counts.size;
  }
  return total / (words.length - VOCABULARY_WINDOW + 1) / VOCABULARY_WINDOW;
}

function analyzeSignals(text: string): { signals: Signal[]; wordCount: number } {
  const words = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const wordCount = words.length;
  const per100 = (n: number) => (wordCount ? (n / wordCount) * 100 : 0);
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => /\p{L}/u.test(s));
  const signals: Signal[] = [];

  const stock = found(text, STOCK_PHRASES);
  signals.push({ type: 'Stock AI phrases', weight: 3, strength: clamp01(per100(stock.length) / 1.5), evidence: phraseEvidence(stock) });

  const hedging = found(text, GENERIC_HEDGING);
  signals.push({ type: 'Generic hedging', weight: 1, strength: clamp01(per100(hedging.length) / 1), evidence: phraseEvidence(hedging) });

  const filler = found(text, FORMAL_FILLER);
  signals.push({ type: 'Formal filler phrases', weight: 1, strength: clamp01(per100(filler.length) / 1), evidence: phraseEvidence(filler) });

  // Academic writing uses "however" and "therefore" often, so only heavy use counts.
  const transitions = found(text, TRANSITIONS);
  signals.push({ type: 'Transition overuse', weight: 1, strength: clamp01((per100(transitions.length) - 1) / 1.5), evidence: phraseEvidence(transitions) });

  if (sentences.length >= 3) {
    const starts = sentences.filter(s => FORMULAIC_START.test(s));
    signals.push({
      type: 'Formulaic sentence openings',
      weight: 1.5,
      strength: clamp01(starts.length / sentences.length / 0.3),
      evidence: `${starts.length} of ${sentences.length} sentences open with a stock phrase`,
    });
  }

  if (sentences.length >= 5) {
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
    const variation = mean ? sd / mean : 0;
    signals.push({
      type: 'Even sentence lengths',
      weight: 2,
      strength: clamp01((0.45 - variation) / 0.25),
      evidence: `Sentences average ${Math.round(mean)} words and vary by ${Math.round(variation * 100)}% around that`,
    });
  }

  if (wordCount >= 100) {
    const variety = vocabularyVariety(words);
    signals.push({
      type: 'Repetitive vocabulary',
      weight: 1,
      strength: clamp01((0.65 - variety) / 0.15),
      evidence: `${Math.round(variety * 100)}% distinct words in each 50-word stretch`,
    });
  }

  return { signals, wordCount };
}

/**
 * Pattern check for wording common in AI-generated text. The score is the
 * weighted share of all applicable signals that show, so one pattern on its
 * own cannot make a text "likely AI", and length alone never raises it.
 */
export function detectAIContent(text: string): AIDetectionResult {
  const { signals, wordCount } = analyzeSignals(text);
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const shown = signals.reduce((sum, s) => sum + s.weight * s.strength, 0);
  const aiScore = totalWeight > 0 ? Math.round((shown / totalWeight) * 100) : 0;
  const enoughText = wordCount >= MIN_WORDS_TO_JUDGE;

  let recommendation = '';
  if (!enoughText) {
    recommendation = `Too little text to judge reliably. Check at least ${MIN_WORDS_TO_JUDGE} words.`;
    if (aiScore > 30) recommendation += ' The patterns listed below are still worth a look.';
  } else if (aiScore > 70) {
    recommendation = 'High likelihood of AI-generated content. Consider significant revision to add original voice and analysis.';
  } else if (aiScore > 50) {
    recommendation = 'Moderate AI indicators detected. Review flagged areas and add more specific, personal analysis.';
  } else if (aiScore > 30) {
    recommendation = 'Some AI patterns detected. Minor revisions recommended to improve originality.';
  } else {
    recommendation = 'Content appears predominantly human-written with minimal AI indicators.';
  }
  recommendation += ' These are writing patterns, not proof of how the text was written.';

  return {
    isLikelyAI: enoughText && aiScore > 50,
    // How much text the call rests on, not how sure the score is.
    confidence: Math.round(Math.min(90, 40 + wordCount / 20)),
    aiScore,
    humanScore: 100 - aiScore,
    indicators: signals
      .filter(s => s.strength > 0)
      .sort((a, b) => b.weight * b.strength - a.weight * a.strength)
      .map(s => ({
        type: s.type,
        description: s.evidence,
        severity: s.strength >= 0.67 ? 'high' : s.strength >= 0.34 ? 'medium' : 'low',
        evidence: s.evidence,
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

export function suggestDisclosureTemplateId(institutionName?: string): string {
  const name = (institutionName || '').toLowerCase();
  if (name.includes('knust') || name.includes('kwame nkrumah')) return 'knust-standard';
  if (name.includes('university of ghana') || name.includes('legon') || /\bug\b/.test(name)) return 'ug-standard';
  if (name.includes('ghana') || name.includes('ucc') || name.includes('upsa') || name.includes('gimpa')) return 'ghanau-apa';
  return 'apa-ai-general';
}
