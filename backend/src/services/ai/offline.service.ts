import { CONFIG } from '../../config/index.js';
import { childLogger } from '../../lib/logger.js';
import type { Source } from '../citations/source.types.js';

const log = childLogger('ai-offline');

/**
 * Offline test mode: with AI_OFFLINE=true, AI calls and the source search
 * return fixed sample output instead of calling Anthropic, OpenAI, Perplexity,
 * OpenAlex or Semantic Scholar. For end-to-end testing at no cost. Refused in
 * production, whatever the environment says.
 */
let warned = false;
export function isOfflineMode(): boolean {
  const on = process.env.AI_OFFLINE === 'true' && CONFIG.NODE_ENV !== 'production';
  if (on && !warned) {
    warned = true;
    log.warn('AI_OFFLINE is on: AI calls and source searches return sample output. Never use this in production.');
  }
  return on;
}

const between = (text: string, start: string, end: string) => {
  const from = text.indexOf(start);
  if (from === -1) return '';
  const rest = text.slice(from + start.length);
  const to = rest.indexOf(end);
  return (to === -1 ? rest : rest.slice(0, to)).trim();
};

/** A care study section written from the student's entries, as the real model would. */
function careStudyDraft(prompt: string): string {
  const title = (prompt.match(/SECTION TO WRITE: (.+?)(?: \(part of|\n)/)?.[1] ?? 'Section').toUpperCase();
  const entries = between(prompt, "THE STUDENT'S ENTRIES FOR THIS SECTION (the only facts you may state):\n\"\"\"", '"""');
  const firstSource = prompt.match(/SOURCES YOU MAY CITE[^\n]*\n- \(([^,]+), (\d{4}|n\.d\.)\)/);
  const cite = firstSource ? ` (${firstSource[1]}, ${firstSource[2]})` : '';

  const lines = entries.split('\n').filter((l) => l.trim() && l !== '(nothing entered)');
  const problems = lines.filter((l) => /^Problem \d+:/.test(l)).length;
  const out = [title, ''];

  if (problems) {
    // Care plan: a table built from the student's problems.
    const items: Record<string, string>[] = [];
    let current: Record<string, string> | null = null;
    for (const l of lines) {
      if (/^Problem \d+:/.test(l)) { current = {}; items.push(current); continue; }
      const m = l.match(/^\s+([^:]+): (.*)$/);
      if (current && m) current[m[1]] = m[2];
    }
    out.push('PROBLEMS IDENTIFIED');
    items.forEach((it, i) => out.push(`${i + 1}. ${it['Problem'] ?? '[Student to supply: problem]'} on ${it['Date and time identified'] ?? '[Student to supply: date]'}`));
    out.push('', 'TABLE 1: NURSING CARE PLAN',
      '| DATE/TIME | NURSING DIAGNOSIS | NURSING OBJECTIVES/OUTCOME CRITERIA | NURSING ORDERS | NURSING INTERVENTIONS | DATE/TIME | EVALUATION | SIGN |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const it of items) {
      out.push(`| ${it['Date and time identified'] ?? ''} | ${it['Problem'] ?? ''} related to ${it['Related to (cause)'] ?? ''} | ${it['Objective'] ?? ''} | ${(it['What you planned to do'] ?? '').replace(/\|/g, '/')} | ${(it['What you actually did'] ?? '').replace(/\|/g, '/')} | ${it['Date and time evaluated'] ?? '[Student to supply: date evaluated]'} | ${it['Outcome'] ?? ''} | [Student to supply: initials] |`);
    }
  } else {
    out.push(`[Offline test draft] This section is written only from the notes the student entered.${cite}`);
    for (const l of lines) {
      const m = l.match(/^\s*([^:]+): (.*)$/);
      if (m) out.push(`The ${m[1].toLowerCase()} was recorded as follows: ${m[2]}.`);
    }
  }

  // Deliberately invented details, so the test shows the checks catching them.
  out.push('', 'Her blood pressure was 150/95 mmHg on a later visit, which was not in the notes (Fakeauthor, 2019).');
  return out.join('\n');
}

function respond(prompt: string, meta?: Record<string, any>): string {
  const action = meta?.action ?? '';
  if (action === 'care-study-draft') return careStudyDraft(prompt);
  if (action === 'care-study-check') {
    return JSON.stringify([{ section: null, message: '[Offline test review] Does every problem in your care plans have an evaluation? Check with your supervisor.' }]);
  }
  if (action === 'care-study-help') {
    return '[Offline test answer] Look in the antenatal card and the client\'s folder for this, and confirm anything clinical with your supervisor.';
  }
  return '[Offline test response] AI is switched off for this test run.';
}

export function offlineResponse(req: { prompt: string; meta?: Record<string, any>; tier: string }) {
  const text = respond(req.prompt, req.meta);
  return {
    text,
    model: 'offline-test',
    provider: 'anthropic' as const,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    cached: false,
    latencyMs: 0,
    attempts: 0,
    truncated: false,
  };
}

/** Sample sources for the source search, clearly labelled so nobody mistakes them for real ones. */
export function offlineSources(limit: number): Source[] {
  const base: Omit<Source, 'id' | 'title' | 'authors' | 'year'> = {
    type: 'article', origin: 'openalex', ghanaian: true, containerTitle: 'Offline Test Journal',
    snippet: 'Offline test source used for end-to-end testing. Not a real publication.',
  };
  return [
    { ...base, id: 'offline:1', title: '[Offline test source] Antenatal care attendance in Ghana', authors: [{ family: 'Mensah', given: 'Kofi' }, { family: 'Owusu', given: 'Ama' }], year: 2021 },
    { ...base, id: 'offline:2', title: '[Offline test source] Use of the partograph in Ghanaian district hospitals', authors: [{ family: 'Boateng', given: 'Esi' }], year: 2020 },
    { ...base, id: 'offline:3', title: '[Offline test source] Postnatal home visits and newborn outcomes', authors: [{ family: 'Asante', given: 'Yaw' }], year: 2019 },
  ].slice(0, limit);
}
