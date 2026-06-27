import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface StructuralAnalysis {
  chapterCount: number;
  chapterTitles: string[];
  sectionCounts: number[];
  avgParagraphLength: number;
  avgSentencesPerParagraph: number;
  hasCarePlan: boolean;
  hasConceptualFramework: boolean;
  hasEthicalConsiderations: boolean;
  hasDemographicTable: boolean;
}

export interface CitationAnalysis {
  totalReferences: number;
  ghanaianSources: number;
  ghanaianSourcesPercent: number;
  avgCitationAge: number;
  citationYears: number[];
  topInstitutions: string[];
}

export interface DocumentAnalysis {
  documentTitle: string;
  institution: string;
  institutionType: string;
  year: number;
  documentType: string;
  structural: StructuralAnalysis;
  citation: CitationAnalysis;
  snippet: string;
}

export interface BlueprintAggregate {
  institutionType: string;
  sampleSize: number;
  structuralAverages: {
    avgChapterCount: number;
    avgSectionsPerChapter: number[];
    avgParagraphLength: number;
    avgSentencesPerParagraph: number;
    careStudyPercent: number;
    conceptualFrameworkPercent: number;
    ethicalConsiderationsPercent: number;
    demographicTablePercent: number;
  };
  citationAverages: {
    avgTotalReferences: number;
    avgGhanaianSourcesPercent: number;
    avgCitationAge: number;
    topInstitutions: string[];
    topCitationYears: number[];
  };
  commonChapterTitles: string[][];
  examples: DocumentAnalysis[];
}

const CHAPTER_PATTERNS = [
  /^chapter\s+\d+/i,
  /^CHAPTER\s+\d+/,
  /^\d+\.\s+[A-Z]/,
];

const SECTION_PATTERNS = [
  /^\d+\.\d+\s+/,
  /^\d+\.\d+\.\d+\s+/,
];

const GHANAIAN_INSTITUTIONS = [
  'KNUST', 'University of Ghana', 'UG', 'UCC', 'University of Cape Coast',
  'UEW', 'University of Education', 'UDS', 'University for Development',
  'UMaT', 'University of Mines', 'UENR', 'University of Energy',
  'Ashesi', 'Presbyterian University', 'GCTU', 'UniMAC',
  'Accra Technical', 'Koforidua Technical', 'Holy Family',
  'Nursing and Midwifery', 'Ghana', 'Kumasi', 'Accra', 'Tamale',
  'Cape Coast', 'Winneba', 'Ho', 'Sunyani', 'Tarkwa', 'Berekum',
  'Ghana Health Service', 'GHS', 'GES', 'NaCCA', 'NMC Ghana',
];

const CARE_PLAN_KEYWORDS = [
  'care plan', 'nursing diagnosis', 'nursing intervention',
  'goal:', 'intervention:', 'evaluation:',
  'objective:', 'subjective:', 'assessment:',
];

const STRUCTURAL_KEYWORDS = {
  conceptualFramework: ['conceptual framework', 'theoretical framework', 'framework diagram'],
  ethicalConsiderations: ['ethical consideration', 'ethical clearance', 'informed consent', 'institutional review board'],
  demographicTable: ['demographic characteristic', 'socio-demographic', 'background information', 'respondent profile'],
  carePlan: ['care plan', 'nursing care plan', 'client problem'],
};

function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
}

function splitIntoSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

function findChapters(text: string): { titles: string[]; chapterCount: number } {
  const lines = text.split('\n');
  const titles: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isChapter = CHAPTER_PATTERNS.some(p => p.test(trimmed));
    if (isChapter && trimmed.length > 5 && trimmed.length < 100) {
      titles.push(trimmed);
    }
  }

  const uniqueTitles = [...new Set(titles)];
  return {
    titles: uniqueTitles,
    chapterCount: uniqueTitles.length || 5,
  };
}

function countSections(text: string): number {
  const lines = text.split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (SECTION_PATTERNS.some(p => p.test(trimmed))) {
      count++;
    }
  }
  return count;
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function isGhanaianSource(text: string): boolean {
  return GHANAIAN_INSTITUTIONS.some(inst => text.toLowerCase().includes(inst.toLowerCase()));
}

function extractCitationYears(text: string): number[] {
  const yearPattern = /\((\d{4})\)/g;
  const years: number[] = [];
  let match;
  while ((match = yearPattern.exec(text)) !== null) {
    const year = parseInt(match[1]);
    if (year >= 1990 && year <= 2026) years.push(year);
  }
  return years;
}

function extractReferences(text: string): string[] {
  const refPatterns = [
    /references?\s*\n([\s\S]*?)(?:appendix|appendices|$)/i,
    /bibliography\s*\n([\s\S]*?)(?:appendix|appendices|$)/i,
  ];

  for (const pattern of refPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].split(/\n/).filter(line => line.trim().length > 20);
    }
  }

  const lines = text.split('\n');
  const references: string[] = [];
  let inReferences = false;

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed === 'references' || trimmed === 'bibliography') {
      inReferences = true;
      continue;
    }
    if (inReferences && trimmed.length > 20) {
      references.push(line.trim());
    }
    if (inReferences && /^(appendix|appendices|chapter|table of)/.test(trimmed)) {
      break;
    }
  }

  return references;
}

export function analyzeDocument(text: string, metadata: {
  title: string;
  institution: string;
  institutionType: string;
  year: number;
  documentType: string;
}): DocumentAnalysis {
  const paragraphs = splitIntoParagraphs(text);
  const { titles: chapterTitles, chapterCount } = findChapters(text);
  const sections = countSections(text);

  const paragraphsPerChapter = chapterCount > 0 ? Math.ceil(paragraphs.length / chapterCount) : paragraphs.length;
  const allSentences = paragraphs.flatMap(p => splitIntoSentences(p));
  const avgSentencesPerParagraph = paragraphs.length > 0
    ? Math.round(allSentences.length / paragraphs.length * 10) / 10
    : 0;

  const avgParagraphLength = paragraphs.length > 0
    ? Math.round(paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / paragraphs.length)
    : 0;

  const references = extractReferences(text);
  const citationYears = extractCitationYears(text);
  const ghanaianCount = references.filter(r => isGhanaianSource(r)).length;

  const institutionalCounts: Record<string, number> = {};
  for (const ref of references) {
    for (const inst of GHANAIAN_INSTITUTIONS) {
      if (ref.toLowerCase().includes(inst.toLowerCase())) {
        institutionalCounts[inst] = (institutionalCounts[inst] || 0) + 1;
      }
    }
  }
  const topInstitutions = Object.entries(institutionalCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([inst]) => inst);

  const avgCitationAge = citationYears.length > 0
    ? Math.round(citationYears.reduce((sum, y) => sum + (2026 - y), 0) / citationYears.length * 10) / 10
    : 0;

  return {
    documentTitle: metadata.title,
    institution: metadata.institution,
    institutionType: metadata.institutionType,
    year: metadata.year,
    documentType: metadata.documentType,
    structural: {
      chapterCount,
      chapterTitles,
      sectionCounts: chapterCount > 0
        ? Array(chapterCount).fill(Math.ceil(sections / chapterCount))
        : [sections],
      avgParagraphLength,
      avgSentencesPerParagraph,
      hasCarePlan: hasKeyword(text, STRUCTURAL_KEYWORDS.carePlan),
      hasConceptualFramework: hasKeyword(text, STRUCTURAL_KEYWORDS.conceptualFramework),
      hasEthicalConsiderations: hasKeyword(text, STRUCTURAL_KEYWORDS.ethicalConsiderations),
      hasDemographicTable: hasKeyword(text, STRUCTURAL_KEYWORDS.demographicTable),
    },
    citation: {
      totalReferences: references.length,
      ghanaianSources: ghanaianCount,
      ghanaianSourcesPercent: references.length > 0
        ? Math.round(ghanaianCount / references.length * 100)
        : 0,
      avgCitationAge,
      citationYears,
      topInstitutions,
    },
    snippet: paragraphs.slice(0, 3).join('\n\n').substring(0, 500),
  };
}

export function aggregateAnalyses(analyses: DocumentAnalysis[]): BlueprintAggregate {
  const byType = analyses.reduce((acc, a) => {
    acc[a.institutionType] = acc[a.institutionType] || [];
    acc[a.institutionType].push(a);
    return acc;
  }, {} as Record<string, DocumentAnalysis[]>);

  const results: Record<string, BlueprintAggregate> = {};

  for (const [instType, docs] of Object.entries(byType)) {
    const avg = <T extends number>(arr: T[]): number =>
      arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10 : 0;

    const allSectionsPerChapter = docs.map(d => {
      const s = d.structural.sectionCounts;
      const padded = [...s, ...Array(Math.max(0, 5 - s.length)).fill(0)];
      return padded;
    });

    const sectionsPerChapter = allSectionsPerChapter[0]?.map((_, i) =>
      avg(allSectionsPerChapter.map(row => row[i] || 0))
    ) || [];

    results[instType] = {
      institutionType: instType,
      sampleSize: docs.length,
      structuralAverages: {
        avgChapterCount: avg(docs.map(d => d.structural.chapterCount)),
        avgSectionsPerChapter: sectionsPerChapter,
        avgParagraphLength: avg(docs.map(d => d.structural.avgParagraphLength)),
        avgSentencesPerParagraph: avg(docs.map(d => d.structural.avgSentencesPerParagraph)),
        careStudyPercent: Math.round(docs.filter(d => d.structural.hasCarePlan).length / docs.length * 100),
        conceptualFrameworkPercent: Math.round(docs.filter(d => d.structural.hasConceptualFramework).length / docs.length * 100),
        ethicalConsiderationsPercent: Math.round(docs.filter(d => d.structural.hasEthicalConsiderations).length / docs.length * 100),
        demographicTablePercent: Math.round(docs.filter(d => d.structural.hasDemographicTable).length / docs.length * 100),
      },
      citationAverages: {
        avgTotalReferences: avg(docs.map(d => d.citation.totalReferences)),
        avgGhanaianSourcesPercent: avg(docs.map(d => d.citation.ghanaianSourcesPercent)),
        avgCitationAge: avg(docs.map(d => d.citation.avgCitationAge)),
        topInstitutions: [...new Set(docs.flatMap(d => d.citation.topInstitutions))].slice(0, 10),
        topCitationYears: [...new Set(docs.flatMap(d => d.citation.citationYears))]
          .sort((a, b) => b - a)
          .slice(0, 10),
      },
      commonChapterTitles: docs[0]?.structural.chapterTitles
        ? [docs[0].structural.chapterTitles]
        : [],
      examples: docs.slice(0, 5),
    };
  }

  return results[analyses[0]?.institutionType || 'university'] || {
    institutionType: 'university',
    sampleSize: 0,
    structuralAverages: {
      avgChapterCount: 5,
      avgSectionsPerChapter: [7, 5, 9, 7, 6],
      avgParagraphLength: 80,
      avgSentencesPerParagraph: 4,
      careStudyPercent: 0,
      conceptualFrameworkPercent: 70,
      ethicalConsiderationsPercent: 90,
      demographicTablePercent: 85,
    },
    citationAverages: {
      avgTotalReferences: 30,
      avgGhanaianSourcesPercent: 25,
      avgCitationAge: 6,
      topInstitutions: ['KNUST', 'University of Ghana', 'UCC'],
      topCitationYears: [2023, 2022, 2021, 2020],
    },
    commonChapterTitles: [[]],
    examples: [],
  };
}

const BLUEPRINT_DIR = join(__dirname, '..', '..', 'blueprints');

export function saveBlueprint(blueprint: BlueprintAggregate): void {
  if (!existsSync(BLUEPRINT_DIR)) {
    mkdirSync(BLUEPRINT_DIR, { recursive: true });
  }
  const filePath = join(BLUEPRINT_DIR, `${blueprint.institutionType}.blueprint.json`);
  writeFileSync(filePath, JSON.stringify(blueprint, null, 2));
  console.log(`  Blueprint saved: ${filePath}`);
}

export function loadBlueprint(institutionType: string): BlueprintAggregate | null {
  const filePath = join(BLUEPRINT_DIR, `${institutionType}.blueprint.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}
