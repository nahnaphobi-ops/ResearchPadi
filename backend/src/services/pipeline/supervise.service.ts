import { routeSupervision } from '../ai/router.service';
import { buildSupervisionPrompt } from '../ai/prompts';

export const supervisePaper = async (
  fullPaper: string,
  paperData: any,
  allSources: any[]
) => {
  const prompt = buildSupervisionPrompt(
    fullPaper,
    paperData.topic,
    paperData.course,
    paperData.institution_type,
    paperData.target_word_count,
    allSources
  );

  const revisedPaper = await routeSupervision(fullPaper, prompt);
  return revisedPaper;
};
