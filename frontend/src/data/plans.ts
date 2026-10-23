/**
 * Single source of truth for what each plan includes. Used by the landing
 * pricing section and the Subscribe page. Keep this in line with the backend:
 * prices in backend/src/config (PRICING) and limits in backend/src/lib/workspace-plans.ts.
 */

export const FULL_PAPER = {
  price: 250,
  features: [
    'A full researched draft to study and learn from',
    'Structured for your institution and programme',
    'AI supervisor review before delivery',
    'References checked, with doubtful ones flagged',
    'Word or PDF download, clearly marked as AI-written',
  ],
};

/** The Workspace without a subscription. */
export const FREE_PLAN = {
  name: 'Free',
  desc: 'Try the Workspace before you pay',
  features: [
    'Up to 2 documents',
    'Quick AI edits: rewrite, shorten, fix grammar, academic tone, simplify',
    'Autocomplete as you type: 10 suggestions a day',
    'Grammar and AI-writing checks, and citation search',
    'Up to 3 of your own sources per document',
    'Export to Word (.docx)',
  ],
} as const;

export const WORKSPACE_PLANS = {
  standard: {
    name: 'Standard',
    price: 120,
    desc: 'Assisted writing for regular coursework',
    features: [
      'Up to 5 workspace sessions',
      'AI writing assistant (continue, expand, shorten, rewrite)',
      'Autocomplete as you type, with no daily limit',
      'Up to 10 of your own sources per document',
      'Grammar, claim and plagiarism checks',
      'Citation search (OpenAlex + Semantic Scholar)',
      'APA, MLA, Chicago and Harvard formats',
      'Export to Word (.docx)',
    ],
  },
  premium: {
    name: 'Premium',
    price: 200,
    desc: 'For theses, dissertations and long projects',
    features: [
      'Everything in Standard',
      'Unlimited workspace sessions',
      'AI inside the editor: select text to improve, explain or continue it',
      'Up to 20 sources per document, and ask questions about them',
      'Book a human supervisor review of your writing',
      'Priority support',
    ],
  },
} as const;

export type WorkspacePlanKey = keyof typeof WORKSPACE_PLANS;
