import { BookOpen, FileText, GraduationCap, Quote, type LucideIcon } from 'lucide-react';
import type { PlanKey } from '../utils/planIntent';
import { FULL_PAPER, WORKSPACE_PLANS } from './plans';

/**
 * Landing page copy. Keep every claim here verifiable — no invented user
 * counts, ratings, or testimonials (see data/testimonials.ts for real quotes).
 */

export const navItems = [
  { label: 'Home', id: 'top' },
  { label: 'Features', id: 'about' },
  { label: 'What you get', id: 'offer' },
  { label: 'Pricing', id: 'pricing' },
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
    title: 'Write a complete research paper',
    desc: 'Give us your topic and brief. We draft the whole paper, chapter by chapter, ready for you to review.',
    points: ['Brief-to-outline structuring', 'Chapter-by-chapter drafting', 'APA 7th citations, DOCX export'],
    image: '/landing/course-research.webp',
    imageAlt: 'Student writing a research paper in a university library',
    plan: 'paper',
    planLabel: 'Complete Paper · GHS 250 per paper',
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
    key: 'paper',
    name: 'Complete Paper',
    price: `GHS ${FULL_PAPER.price}`,
    period: '/paper',
    desc: 'Full end-to-end AI paper generation',
    features: FULL_PAPER.features,
    cta: 'Order a Paper',
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
  { q: 'What makes ResearchPadi different from ChatGPT?', a: 'ResearchPadi is built around Ghanaian academic work: it writes for your institution and programme, uses standard citation styles, and draws on sources from Ghanaian university repositories. Your draft lives in a research workspace with citations and checks — not a generic chat thread.' },
  { q: 'Is the content plagiarism-free?', a: 'Drafts are written fresh for your brief, and before you export, our plagiarism check compares your text against the Ghanaian academic repositories we index. Always review your draft and run your university\'s own checker before submitting.' },
  { q: 'Which universities does ResearchPadi support?', a: 'We support Ghanaian tertiary institutions including KNUST, University of Ghana, UCC, UPSA, GIMPA, Ashesi, Technical Universities, and more.' },
  { q: 'Can I use ResearchPadi for my thesis or dissertation?', a: 'Yes. The workspace has outline, abstract and chapter tools, and Premium removes the session limit so a long thesis fits in one place. The Complete Paper service can also draft up to 25,000 words.' },
  { q: 'How accurate are the citations?', a: 'Citations come from real academic databases (OpenAlex and Semantic Scholar) and are cross-checked before they reach your draft. We support APA, MLA, Chicago, and Harvard. Always confirm each source before you submit.' },
];
