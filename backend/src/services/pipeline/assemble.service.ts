import { buildAbstractPrompt } from '../ai/prompts.js';
import { routeDrafting } from '../ai/router.service.js';
import { childLogger } from '../../lib/logger.js';
import { buildReferenceList, citedSources } from './references.service.js';
import type { PaperSource } from './paper-source.js';

const log = childLogger('assemble');

/** APA reference list for the sources the chapters cite, built in code (see references.service). */
export const generateReferences = (paperText: string, sources: PaperSource[]): string => {
  const cited = citedSources(paperText, sources);
  if (!cited.length) {
    // No citation matched a source (unusual): list every source rather than none.
    log.warn({ sources: sources.length }, 'No in-text citations matched the sources; listing all sources');
    return buildReferenceList(sources);
  }
  return buildReferenceList(cited);
};

export const generateAbstract = async (fullPaper: string, paperData: any) => {
  const prompt = buildAbstractPrompt(fullPaper, paperData.topic, paperData.institution_type);
  const abstract = await routeDrafting(prompt, { type: 'abstract' });
  return abstract;
};

export const assembleFullPaper = (chapters: string[], abstract: string, references: string) => {
  return `
${abstract}

${chapters.join('\n\n')}

${references}
  `.trim();
};
