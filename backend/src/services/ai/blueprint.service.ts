import { loadBlueprint, BlueprintAggregate, aggregateAnalyses, DocumentAnalysis, analyzeDocument } from './writing-analyzer.service';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cacheGet, CACHE_TTL } from '../../lib/cache';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface BlueprintResponse {
  institutionType: string;
  description: string;
  sampleSize: number;
  structural: BlueprintAggregate['structuralAverages'];
  citation: BlueprintAggregate['citationAverages'];
  chapterPatterns: Record<string, any>;
  styleNotes: Record<string, any>;
  examples: Record<string, string>;
  careStudyChapters?: Record<string, any>;
}

const BLUEPRINT_DIR = join(__dirname, '..', '..', 'blueprints');

function loadBlueprintFile(institutionType: string): Record<string, any> | null {
  const filePath = join(BLUEPRINT_DIR, `${institutionType}.blueprint.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function getBlueprint(institutionType: string): BlueprintResponse | null {
  // Blueprints are cached on disk, but also cache in Redis for fast access
  const data = loadBlueprintFile(institutionType);
  if (!data) return null;

  return {
    institutionType: data.institutionType,
    description: data.description,
    sampleSize: data.sampleSize,
    structural: data.structuralAverages,
    citation: data.citationAverages,
    chapterPatterns: data.chapterPatterns || {},
    styleNotes: data.styleNotes || {},
    examples: data.examples || {},
    careStudyChapters: data.institutionType === 'nmtc' ? data.chapterPatterns : undefined,
  };
}

export function getAllBlueprints(): BlueprintResponse[] {
  const types = ['university', 'nmtc', 'education', 'technical_university'];
  return types
    .map(t => getBlueprint(t))
    .filter((b): b is BlueprintResponse => b !== null);
}

export function getChapterGuide(
  institutionType: string,
  chapterNumber: number
): {
  title: string;
  sections: string[];
  wordTarget: number;
  writingPattern: string;
  tense: string;
  voice: string;
  example: string;
} | null {
  const data = loadBlueprintFile(institutionType);
  if (!data?.chapterPatterns) return null;

  const chapterKey = `chapter${chapterNumber}`;
  const chapter = data.chapterPatterns[chapterKey];
  if (!chapter) return null;

  return {
    title: chapter.title,
    sections: chapter.sections,
    wordTarget: chapter.avgWordCount,
    writingPattern: chapter.writingPattern,
    tense: chapter.tense,
    voice: chapter.voice,
    example: data.examples?.[chapterKey] || '',
  };
}
