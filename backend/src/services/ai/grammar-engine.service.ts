export interface GrammarIssue {
  type: 'grammar' | 'spelling' | 'style' | 'academic' | 'clarity' | 'citation';
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  original: string;
  suggestion: string;
  position: { start: number; end: number };
  rule: string;
}

interface GrammarRule {
  name: string;
  type: GrammarIssue['type'];
  severity: GrammarIssue['severity'];
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  message: string;
  rule?: string;
}

const GRAMMAR_RULES: GrammarRule[] = [
  {
    name: 'passive_voice_overuse',
    type: 'academic',
    severity: 'suggestion',
    pattern: /\b(is|are|was|were|been|be|being)\s+(being\s+)?(\w+ed)\b/gi,
    replacement: (m) => m,
    message: 'Consider using active voice for clearer, more direct academic writing',
    rule: 'Academic Style: Active Voice',
  },
  {
    name: 'weakeners',
    type: 'style',
    severity: 'suggestion',
    pattern: /\b(very|really|quite|rather|somewhat|fairly|pretty much|kind of|sort of)\b/gi,
    replacement: '',
    message: 'Avoid weak qualifiers in academic writing. Use precise language instead.',
    rule: 'Academic Style: Remove Weak Qualifiers',
  },
  {
    name: 'contractions',
    type: 'academic',
    severity: 'warning',
    pattern: /\b(don't|doesn't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|wouldn't|couldn't|shouldn't|won't|can't|it's|that's|there's|here's|what's|who's|let's|he's|she's|we're|they're|you're|I'm|I've|I'll|I'd)\b/gi,
    replacement: (m) => {
      const contractions: Record<string, string> = {
        "don't": "do not", "doesn't": "does not", "isn't": "is not",
        "aren't": "are not", "wasn't": "was not", "weren't": "were not",
        "hasn't": "has not", "haven't": "have not", "hadn't": "had not",
        "wouldn't": "would not", "couldn't": "could not", "shouldn't": "should not",
        "won't": "will not", "can't": "cannot", "it's": "it is",
        "that's": "that is", "there's": "there is", "here's": "here is",
        "what's": "what is", "who's": "who is", "let's": "let us",
        "he's": "he is", "she's": "she is", "we're": "we are",
        "they're": "they are", "you're": "you are", "I'm": "I am",
        "I've": "I have", "I'll": "I will", "I'd": "I would",
      };
      return contractions[m.toLowerCase()] || m;
    },
    message: 'Avoid contractions in formal academic writing.',
    rule: 'Academic Style: No Contractions',
  },
  {
    name: 'first_person',
    type: 'academic',
    severity: 'suggestion',
    pattern: /\b(I |my |me |mine |myself )\b/g,
    replacement: '',
    message: 'Consider removing first-person pronouns in academic writing. Use passive voice or impersonal constructions.',
    rule: 'Academic Style: First Person',
  },
  {
    name: 'informal_phrases',
    type: 'style',
    severity: 'warning',
    pattern: /\b(a lot of|lots of|bunch of|ton of|tons of|gonna|wanna|gotta|kinda|sorta|dunno|ain't|y'all|hey|hi|hello|bye|thanks|thank you|ok|okay|sure|yeah|yep|nope|nah|wow|oops|ugh|uh-oh|oh no|yay|hooray|hurray)\b/gi,
    replacement: '',
    message: 'This phrase is too informal for academic writing.',
    rule: 'Academic Style: Informal Language',
  },
  {
    name: 'passive_detection',
    type: 'grammar',
    severity: 'suggestion',
    pattern: /\b(was|were|is|are|been|be|being)\s+(being\s+)?(taken|made|used|found|shown|given|seen|done|known|thought|believed|considered|regarded|treated|handled|placed|put|set|left|held|kept|saved|sent|brought|carried|moved|turned|run|grown|drawn|thrown|blown|broken|chosen|driven|eaten|fallen|forgotten|frozen|given|hidden|ridden|risen|shaken|spoken|stolen|stricken|sworn|torn|worn)\b/gi,
    replacement: (m) => m,
    message: 'This appears to be passive voice. Consider restructuring with active voice.',
    rule: 'Grammar: Passive Voice',
  },
  {
    name: 'vague_language',
    type: 'academic',
    severity: 'suggestion',
    pattern: /\b(stuff|things|aspects|factors|issues|problems|concerns|matters|elements|components|items)\b/gi,
    replacement: '',
    message: 'Replace vague nouns with specific, precise terminology.',
    rule: 'Academic Style: Vague Language',
  },
  {
    name: 'hedging_overuse',
    type: 'academic',
    severity: 'suggestion',
    pattern: /\b(may|might|could|possibly|perhaps|probably|likely|unlikely|seemingly|apparently|arguably|supposedly|presumably)\b/gi,
    replacement: '',
    message: 'Excessive hedging weakens your argument. Use assertive language when supported by evidence.',
    rule: 'Academic Style: Excessive Hedging',
  },
  {
    name: 'redundant_phrases',
    type: 'style',
    severity: 'suggestion',
    pattern: /\b(basic fundamentals|past history|future plans|free gift|true facts|actual事实|end result|final outcome|completely eliminate|absolutely essential|each and every|first and foremost|in order to|due to the fact|in spite of the fact|at this point in time|in the event that)\b/gi,
    replacement: '',
    message: 'This phrase is redundant. Simplify for conciseness.',
    rule: 'Style: Redundancy',
  },
  {
    name: 'comma_splice',
    type: 'grammar',
    severity: 'error',
    pattern: /[^.!?;:],[^.!?;:]*\b(and|but|or|nor|for|yet|so)\b\s+[A-Z]/g,
    replacement: (m) => m,
    message: 'Possible comma splice. Use a semicolon, period, or coordinating conjunction with proper punctuation.',
    rule: 'Grammar: Comma Splice',
  },
  {
    name: 'run_on_sentence',
    type: 'grammar',
    severity: 'error',
    pattern: /\b\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\b/g,
    replacement: (m) => m,
    message: 'This sentence may be too long. Consider breaking it into shorter sentences.',
    rule: 'Grammar: Sentence Length',
  },
  {
    name: 'double_negatives',
    type: 'grammar',
    severity: 'error',
    pattern: /\b(don't|doesn't|didn't|won't|wouldn't|couldn't|shouldn't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't)\s+(no|nothing|nobody|nowhere|neither|never)\b/gi,
    replacement: '',
    message: 'Avoid double negatives in academic writing.',
    rule: 'Grammar: Double Negatives',
  },
  {
    name: 'citation_needed',
    type: 'citation',
    severity: 'warning',
    pattern: /\b(according to|as stated by|research shows|studies indicate|evidence suggests|findings reveal|data indicates|results demonstrate|it is known that|it is well established|it has been shown)\b/gi,
    replacement: (m) => m,
    message: 'This statement requires a citation. Add a reference to support this claim.',
    rule: 'Citation: Attribution Needed',
  },
  {
    name: 'numbers_in_text',
    type: 'academic',
    severity: 'suggestion',
    pattern: /\b(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)\b/gi,
    replacement: '',
    message: 'In academic writing, numbers above ten are typically written as numerals.',
    rule: 'Academic Style: Number Format',
  },
  {
    name: 'that_which',
    type: 'grammar',
    severity: 'suggestion',
    pattern: /\bwhich\b/gi,
    replacement: 'that',
    message: 'In restrictive clauses, prefer "that" over "which".',
    rule: 'Grammar: That vs Which',
  },
];

export function checkGrammar(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];

  for (const rule of GRAMMAR_RULES) {
    let match;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      const isDuplicate = issues.some(
        (i) => i.position.start === start && i.position.end === end
      );
      if (isDuplicate) continue;

      let suggestion = typeof rule.replacement === 'function'
        ? rule.replacement(match[0])
        : rule.replacement;

      if (!suggestion || suggestion === match[0]) {
        suggestion = `[Review: ${rule.message}]`;
      }

      issues.push({
        type: rule.type,
        severity: rule.severity,
        message: rule.message,
        original: match[0],
        suggestion,
        position: { start, end },
        rule: rule.name,
      });
    }
  }

  return issues;
}

export function getGrammarSummary(issues: GrammarIssue[]): {
  total: number;
  errors: number;
  warnings: number;
  suggestions: number;
  byType: Record<string, number>;
  score: number;
} {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const suggestions = issues.filter((i) => i.severity === 'suggestion').length;
  const byType: Record<string, number> = {};

  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }

  const score = Math.max(0, 100 - errors * 5 - warnings * 2 - suggestions * 0.5);

  return {
    total: issues.length,
    errors,
    warnings,
    suggestions,
    byType,
    score: Math.round(score),
  };
}
