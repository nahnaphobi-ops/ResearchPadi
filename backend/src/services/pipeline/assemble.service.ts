import { buildReferenceListPrompt, buildAbstractPrompt } from '../ai/prompts';
import { routeDrafting } from '../ai/router.service';

export const generateReferences = async (citedSources: any[], institutionType: string) => {
  const prompt = buildReferenceListPrompt(citedSources, institutionType);
  const references = await routeDrafting(prompt, { type: 'references' });
  return references;
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
