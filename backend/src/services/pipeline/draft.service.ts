import { routeDrafting } from '../ai/router.service';
import { buildChapterPrompt } from '../ai/prompts';

export const draftChapter = async (
  chapterNumber: number,
  chapterTitle: string,
  sections: string[],
  wordTarget: number,
  paperData: any,
  researchContext: string,
  previousChapters: string,
  allSources: any[]
) => {
  const prompt = buildChapterPrompt(
    chapterNumber,
    chapterTitle,
    sections,
    wordTarget,
    paperData.topic,
    paperData.course,
    paperData.institution_name,
    paperData.programme,
    paperData.institution_type,
    researchContext,
    previousChapters,
    allSources,
    paperData.research_questions
  );

  const draft = await routeDrafting(prompt, { chapterNumber, chapterTitle });
  return draft;
};
