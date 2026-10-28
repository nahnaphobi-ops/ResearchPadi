import { BookOpen, FileText, GraduationCap, Quote, type LucideIcon } from 'lucide-react';
import type { PlanKey } from '../utils/planIntent';
import { FREE_PLAN, FULL_PAPER, WORKSPACE_PLANS } from './plans';

/**
 * Landing page copy. Keep every claim here verifiable — no invented user
 * counts, ratings, or testimonials (see data/testimonials.ts for real quotes).
 */

// The logo already scrolls to the top, so there is no "Home" item.
export const navItems = [
  { label: 'Why ResearchPadi', id: 'about' },
  { label: 'What you get', id: 'offer' },
  { label: 'Pricing', id: 'pricing' },
  { label: 'FAQ', id: 'faqs' },
  { label: 'Contact', id: 'contact' },
];

export type UseCase = {
  key: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  points: string[];
  image: string;
  imageAlt: string;
  plan: PlanKey;
  planLabel: string;
};

export const useCases: UseCase[] = [
  {
    key: 'research',
    icon: FileText,
    title: 'Study from a full research draft',
    desc: 'Give us your topic and brief. We research and draft a full paper, chapter by chapter, for you to study and then rewrite in your own words.',
    points: ['Brief-to-outline structuring', 'Chapter-by-chapter study draft', 'Checked references, Word or PDF download'],
    image: '/landing/course-research.webp',
    imageAlt: 'Student writing a research paper in a university library',
    plan: 'paper',
    planLabel: 'Study Draft · GHS 250 per draft',
  },
  {
    key: 'thesis',
    icon: GraduationCap,
    title: 'Thesis and dissertation chapters',
    desc: 'Work through long projects chapter by chapter, with the structure your supervisor expects.',
    points: ['Outline and abstract generation', 'Methodology and chapter help', 'Unlimited sessions for long projects'],
    image: '/landing/course-thesis.webp',
    imageAlt: 'Postgraduate student working through thesis chapters',
    plan: 'premium',
    planLabel: 'Premium · GHS 200 for 30 days',
  },
  {
    key: 'review',
    icon: BookOpen,
    title: 'Literature reviews from African sources',
    desc: 'Find and synthesise sources, including Ghanaian university repositories, inside your workspace.',
    points: ['Sources from Ghanaian repositories', 'Suggested citations for your text', 'Ask the AI to compare and synthesise'],
    image: '/landing/course-literature.webp',
    imageAlt: 'Academic journals and notes for a literature review',
    plan: 'standard',
    planLabel: 'Standard · GHS 120 for 30 days',
  },
  {
    key: 'cite',
    icon: Quote,
    title: 'Citations and editing',
    desc: 'Search for real sources and keep in-text citations and your reference list consistent.',
    points: ['APA · MLA · Chicago · Harvard', 'Live citation search', 'AI writing assist while you edit'],
    image: '/landing/course-citations.webp',
    imageAlt: 'Student preparing academic citations at a desk',
    plan: 'standard',
    planLabel: 'Standard · GHS 120 for 30 days',
  },
];

export const pricingPlans: {
  key: PlanKey;
  name: string;
  price: string;
  period: string;
  desc: string;
  features: readonly string[];
  cta: string;
  highlighted: boolean;
}[] = [
  {
    key: 'free',
    name: FREE_PLAN.name,
    price: 'GHS 0',
    period: 'no payment',
    desc: FREE_PLAN.desc,
    features: FREE_PLAN.features,
    cta: 'Start free',
    highlighted: false,
  },
  {
    key: 'paper',
    name: 'Study Draft',
    price: `GHS ${FULL_PAPER.price}`,
    period: '/draft',
    desc: 'A full AI research draft to learn from',
    features: FULL_PAPER.features,
    cta: 'Order a Study Draft',
    highlighted: false,
  },
  {
    key: 'standard',
    name: WORKSPACE_PLANS.standard.name,
    price: `GHS ${WORKSPACE_PLANS.standard.price}`,
    period: '/30 days',
    desc: WORKSPACE_PLANS.standard.desc,
    features: WORKSPACE_PLANS.standard.features,
    cta: 'Start Standard',
    highlighted: true,
  },
  {
    key: 'premium',
    name: WORKSPACE_PLANS.premium.name,
    price: `GHS ${WORKSPACE_PLANS.premium.price}`,
    period: '/30 days',
    desc: WORKSPACE_PLANS.premium.desc,
    features: WORKSPACE_PLANS.premium.features,
    cta: 'Start Premium',
    highlighted: false,
  },
];

export const faqs = [
  { q: 'What makes ResearchPadi different from ChatGPT?', a: 'ResearchPadi is built around Ghanaian academic work: it follows your institution and programme\'s format, uses standard citation styles, and draws on sources from Ghanaian university repositories. Your draft lives in a research workspace with citations and checks — not a generic chat thread.' },
  { q: 'Can I submit a study draft as my own work?', a: 'No. A study draft is written by AI, and the downloaded file says so on every page. Use it to understand your topic, plan your chapters and find sources, then write your paper yourself. The Workspace helps you do that with AI beside you. Submitting AI-written work as your own breaks most universities\' rules.' },
  { q: 'Does ResearchPadi check for plagiarism?', a: 'Yes. In the Workspace, our plagiarism check compares your writing against the Ghanaian academic repositories we index. It doesn\'t replace your university\'s own checker, so run that too before you submit.' },
  { q: 'Which universities does ResearchPadi support?', a: 'We support Ghanaian tertiary institutions including KNUST, University of Ghana, UCC, UPSA, GIMPA, Ashesi, Technical Universities, and more.' },
  { q: 'Can I use ResearchPadi for my thesis or dissertation?', a: 'Yes. The workspace has outline, abstract and chapter tools, and Premium removes the session limit so a long thesis fits in one place. A Study Draft can also cover up to 25,000 words for you to learn from.' },
  { q: 'How accurate are the citations?', a: 'Sources come from real academic databases (OpenAlex and Semantic Scholar) and Ghanaian repositories. Before a study draft is delivered, every reference is checked against those sources, and any we can\'t match are flagged on your paper page so you can check or replace them. We support APA, MLA, Chicago and Harvard. Always confirm each source yourself.' },
];
