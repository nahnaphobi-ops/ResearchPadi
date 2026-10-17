import { WORKSPACE_SYSTEM_PROMPT } from './workspace-assist.service.js';

/**
 * Notion-style AI inside the editor: actions on a selection, "/" commands on an
 * empty line, and free-form "Ask AI". The editor inserts the answer in place, so
 * the model must return only the text to insert, as Markdown.
 */
export const INLINE_SYSTEM_PROMPT = `${WORKSPACE_SYSTEM_PROMPT}

OUTPUT FORMAT — the answer is inserted straight into the student's document:
- Return only the text to insert. No preamble ("Here is…"), no explanation, no closing remarks.
- Never wrap the answer in quotation marks or code fences.
- Use Markdown only where structure is needed: "## " for headings, "- " for bullet points,
  "1. " for numbered lists, **bold**, *italic*, and pipe tables (| a | b |) for tables.
- When editing selected text, keep the same language and roughly the same format (a
  paragraph stays a paragraph) unless the instruction asks otherwise.
- Keep existing in-text citations such as (Surname et al., Year) exactly as written. Never
  invent new citations or references.
- For feedback or explanations, write advice for the student, not text for the document.`;

export type InlineAction =
  | 'improve' | 'shorten' | 'expand' | 'grammar' | 'academic' | 'simplify' | 'summarise'
  | 'continue' | 'draft' | 'table' | 'brainstorm' | 'summarise-above' | 'ask' | 'refine'
  | 'feedback' | 'explain';

type Tier = 'light' | 'drafting';

interface ActionSpec {
  tier: Tier;
  needsSelection?: boolean;
  needsPrompt?: boolean;
  instruction: string;
}

const ACTIONS: Record<InlineAction, ActionSpec> = {
  improve: { tier: 'light', needsSelection: true, instruction: 'Improve the writing of the selected text: clarity, flow and academic register. Keep the meaning and roughly the same length.' },
  shorten: { tier: 'light', needsSelection: true, instruction: 'Make the selected text shorter and more direct while keeping every key point.' },
  expand: { tier: 'drafting', needsSelection: true, instruction: 'Expand the selected text with more explanation, evidence and analysis, in the same voice. Do not invent citations.' },
  grammar: { tier: 'light', needsSelection: true, instruction: 'Fix grammar, spelling and punctuation in the selected text. Change nothing else.' },
  academic: { tier: 'light', needsSelection: true, instruction: 'Rewrite the selected text in a formal academic tone suitable for a Ghanaian university thesis.' },
  simplify: { tier: 'light', needsSelection: true, instruction: 'Rewrite the selected text in simpler, clearer language without losing accuracy.' },
  summarise: { tier: 'light', needsSelection: true, instruction: 'Summarise the selected text in one short paragraph.' },
  continue: { tier: 'drafting', instruction: 'Continue writing from exactly where the text before the cursor ends. Write one or two paragraphs that follow on naturally. Do not repeat what is already written.' },
  draft: { tier: 'drafting', needsPrompt: true, instruction: 'Draft the section described in the request, fitting the paper so far. Start with a "## " heading if the request names a section.' },
  table: { tier: 'drafting', needsPrompt: true, instruction: 'Create a table for the request as a Markdown pipe table with a header row. Add a one-line caption above it in the form "Table X: …".' },
  brainstorm: { tier: 'drafting', instruction: 'Brainstorm a bullet list of ideas, arguments or angles for the topic in the request (or the paper so far if there is no request).' },
  'summarise-above': { tier: 'light', instruction: 'Summarise the text before the cursor in one paragraph.' },
  ask: { tier: 'drafting', needsPrompt: true, instruction: 'Carry out the request. If text is selected, the request applies to the selected text and the answer replaces it.' },
  refine: { tier: 'drafting', needsPrompt: true, instruction: 'Revise your previous answer according to the request. Return the full revised answer.' },
  // Advice for the student; the editor shows these without a Replace or Insert button.
  feedback: { tier: 'drafting', needsSelection: true, instruction: 'Give the student feedback on the selected text as a short Markdown list under "**What works**", "**Improve next**" (specific, with why) and "**Needs a source**" (claims that need a citation). Do not rewrite the text; quote at most 8 words when pointing at something.' },
  explain: { tier: 'light', needsSelection: true, instruction: 'Explain the selected text in plain, simple English for a student: what it means and why it matters, in 3 to 5 short sentences. Define any technical term.' },
};

/** Actions whose answer is advice for the student, never text for the document. */
export const ADVICE_ACTIONS = new Set<InlineAction>(['feedback', 'explain']);

export function isInlineAction(value: unknown): value is InlineAction {
  return typeof value === 'string' && value in ACTIONS;
}

export interface InlineInput {
  action: InlineAction;
  text?: string;      // the selection, if any
  before?: string;    // document text before the cursor / selection
  after?: string;     // document text after it
  prompt?: string;    // the student's request
  previous?: string;  // the previous answer, for 'refine'
  title?: string;     // document title
  outline?: string;   // the document's headings, one per line
}

const clip = (value: string | undefined, max: number, fromEnd = false) => {
  const v = (value ?? '').trim();
  if (v.length <= max) return v;
  return fromEnd ? `…${v.slice(v.length - max)}` : `${v.slice(0, max)}…`;
};

/** Validates the request and builds the per-call prompt (the system prompt is shared and cached). */
export function buildInlinePrompt(input: InlineInput): { tier: Tier; prompt: string; maxTokens: number } | { error: string } {
  const spec = ACTIONS[input.action];
  const text = clip(input.text, 12_000);
  const prompt = clip(input.prompt, 1_000);
  if (spec.needsSelection && !text) return { error: 'Select some text first.' };
  if (spec.needsPrompt && !prompt) return { error: 'Tell the AI what you want.' };
  if (input.action === 'refine' && !input.previous?.trim()) return { error: 'Nothing to refine yet.' };

  const parts: string[] = [];
  if (input.title) parts.push(`DOCUMENT TITLE: ${clip(input.title, 200)}`);
  const outline = clip(input.outline, 2_000);
  if (outline) parts.push(`DOCUMENT OUTLINE (its headings; fit new material into this structure):\n${outline}`);
  const before = clip(input.before, 4_000, true);
  const after = clip(input.after, 1_500);
  if (before) parts.push(`TEXT BEFORE THE ${text ? 'SELECTION' : 'CURSOR'} (context only):\n${before}`);
  if (after) parts.push(`TEXT AFTER IT (context only):\n${after}`);
  if (text) parts.push(`SELECTED TEXT:\n${text}`);
  if (input.action === 'refine') parts.push(`YOUR PREVIOUS ANSWER:\n${clip(input.previous, 12_000)}`);
  parts.push(`TASK: ${spec.instruction}`);
  if (prompt) parts.push(`REQUEST: ${prompt}`);

  return { tier: spec.tier, prompt: parts.join('\n\n'), maxTokens: spec.tier === 'light' ? 2_000 : 4_000 };
}
