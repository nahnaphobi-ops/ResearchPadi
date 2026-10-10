/**
 * Single source of truth for what each plan includes. Used by the landing
 * pricing section and the Subscribe page. Keep this in line with the backend:
 * prices in backend/src/config (PRICING) and limits in subscription.middleware.ts.
 */

export const FULL_PAPER = {
  price: 250,
  features: [
    'Complete paper researched and written for you',
    'AI supervisor review before delivery',
    'APA 7th Edition citations',
    'Tailored to your institution and programme',
    'DOCX download with AI disclosure',
  ],
};

export const WORKSPACE_PLANS = {
  standard: {
    name: 'Standard',
    price: 120,
    desc: 'Assisted writing for regular coursework',
    features: [
      'Up to 5 workspace sessions',
      'AI writing assistant (continue, expand, shorten, rewrite)',
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
      'Priority support',
    ],
  },
} as const;

export type WorkspacePlanKey = keyof typeof WORKSPACE_PLANS;
