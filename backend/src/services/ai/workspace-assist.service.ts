import { routeDrafting } from './router.service.js';
import { searchOpenAlex } from '../citations/openalex.service.js';
import { searchSemanticScholar } from '../citations/semantic.service.js';
import { retrieveContext } from '../rag/retriever.service.js';
import { formatCitation, type CitationStyle, type CitationData } from '../citations/formatter.service.js';

export interface AssistResult {
  response: string;
  type: string;
}

const WORKSPACE_SYSTEM_PROMPT = `You are an AI writing assistant for a Ghanaian student's research paper.
Follow these rules:
- Maintain the researcher's voice and academic tone
- Reference Ghanaian context naturally where relevant
- Use UK English spelling and conventions throughout (e.g. organisation, behaviour, centre, analyse, programme, practise, colour, favour, honour, labour, defence, modelling, cancelled, travelled, summarise, recognise, emphasise, licence, offence, practice is a noun -- only ever use British English)
- Do not use banned AI words: "Furthermore", "Moreover", "Additionally", "Delve into", "Underscore", "Pivotal", "Paramount", "Multifaceted", "Nuanced", "Shed light on", "In the realm of", "Leverage", "Embark on", "Robust", "Groundbreaking", "Cutting-edge", "At the end of the day", "In today's world"
- Use APA 7th edition citation format
- Always maintain third person perspective
- Never use contractions
- Vary sentence length and structure`;

const INSTRUCTIONS: Record<string, string> = {
  continue: 'Continue writing from where the user left off. Match the existing style, voice, and tone. Write the next logical section or paragraphs.',
  expand: 'Expand on the selected text. Add more detail, examples, evidence, and analysis while maintaining the same voice.',
  shorten: 'Shorten the selected text while keeping the key points. Make it more concise and direct.',
  rewrite: 'Rewrite the selected text to improve clarity, flow, and academic quality. Keep the same meaning.',
  grammar: 'Fix all grammar, punctuation, and spelling errors. Also improve sentence structure where needed.',
  tone: 'Change the tone of the selected text to be more formal and academic while keeping the same content.',
  outline: 'Generate a detailed outline for a research paper on this topic. Include chapter titles, section headings, and brief descriptions of what each section should cover.',
  abstract: 'Generate a structured abstract (250-350 words) based on the provided content. Include: Background, Methods, Findings, Conclusion.',
};

export const assistWithText = async (
  selectedText: string,
  instruction: string,
  context?: string,
  plan?: string
): Promise<AssistResult> => {
  const systemContext = WORKSPACE_SYSTEM_PROMPT;
  const instructionText = INSTRUCTIONS[instruction] || instruction;

  let prompt = '';
  if (selectedText) {
    prompt = `${systemContext}\n\n${instructionText}\n\nSelected text:\n${selectedText}`;
  } else {
    prompt = `${systemContext}\n\n${instructionText}`;
  }
  if (context) {
    prompt += `\n\nAdditional context from the paper:\n${context}`;
  }

  try {
    const response = await routeDrafting(prompt, {});
    return { response, type: instruction };
  } catch (err: any) {
    if (err.message?.includes('API key') || err.message?.includes('ANTHROPIC_API_KEY') || err.message?.includes('OPENAI_API_KEY')) {
      return {
        response: 'AI features require an API key. Please add your Anthropic or OpenAI API key to the backend .env file (ANTHROPIC_API_KEY or OPENAI_API_KEY) to enable AI writing assistance.',
        type: instruction,
      };
    }
    throw err;
  }
};

export const searchCitations = async (topic: string, query?: string, format?: CitationStyle) => {
  const searchTerm = query || topic;
  const citationStyle: CitationStyle = format || 'apa';

  const [openAlexResults, semanticResults, ragResults] = await Promise.all([
    searchOpenAlex(searchTerm).catch(() => []),
    searchSemanticScholar(searchTerm).catch(() => []),
    retrieveContext(searchTerm).catch(() => []),
  ]);

  const mapWithFormat = (r: any, overrides: Partial<CitationData>): CitationData & { formatted: string } => {
    const citation: CitationData = {
      title: r.title || r.document_title,
      authors: r.authors || r.author_name,
      year: r.year || r.publication_year,
      source: r.source || r.venue,
      url: r.url || r.doi,
      type: 'academic',
      ...overrides,
    };
    return { ...citation, formatted: formatCitation(citation, citationStyle) };
  };

  const citations = [
    ...(openAlexResults || []).map((r: any) =>
      mapWithFormat(r, { source: r.venue || 'OpenAlex' })
    ),
    ...(semanticResults || []).map((r: any) =>
      mapWithFormat(r, { source: 'Semantic Scholar' })
    ),
    ...(ragResults || []).map((r: any) =>
      mapWithFormat(r, {
        title: r.document_title,
        institution: r.institution,
        chunk_text: r.chunk_text?.substring(0, 200),
        source: 'Ghanaian Repository',
        type: 'rag',
      })
    ),
  ];

  return { citations: citations.slice(0, 20), format: citationStyle };
};
