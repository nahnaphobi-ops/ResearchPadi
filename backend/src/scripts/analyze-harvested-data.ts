import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { analyzeDocument, aggregateAnalyses, saveBlueprint, DocumentAnalysis } from '../services/ai/writing-analyzer.service.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Map source names to institution types
const SOURCE_TO_INST: Record<string, string> = {
  'Ashesi_AIR': 'university',
  'UGSpace': 'university',
  'KNUSTSpace': 'university',
  'KNUST': 'university',
  'UCCSpace': 'university',
  'UEW_IR': 'college_of_education',
  'HF_NMTC_Berekum': 'nmtc',
};

async function analyzeHarvestedData() {
  console.log('\n=== Analyzing Harvested Data for Blueprint Generation ===\n');

  const { count: totalChunks } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true });

  console.log(`Total chunks in knowledge base: ${totalChunks || 0}`);

  if (!totalChunks || totalChunks === 0) {
    console.log('No data to analyze. Run harvest first.');
    return;
  }

  const sources = ['Ashesi_AIR', 'UGSpace', 'KNUST', 'HF_NMTC_Berekum'];

  for (const sourceName of sources) {
    const instType = SOURCE_TO_INST[sourceName] || 'university';
    console.log(`\n--- Analyzing ${sourceName} (${instType}) documents ---`);

    const { data: chunks } = await supabase
      .from('knowledge_chunks')
      .select('document_title, authors, year, institution, source_name, chunk_text, source_url')
      .eq('source_name', sourceName)
      .limit(500);

    if (!chunks || chunks.length === 0) {
      console.log(`  No chunks found for ${sourceName}. Skipping.`);
      continue;
    }

    const docMap = new Map<string, { title: string; institution: string; year: number; chunks: string[] }>();

    for (const chunk of chunks) {
      const key = chunk.source_url || chunk.document_title;
      if (!docMap.has(key)) {
        docMap.set(key, {
          title: chunk.document_title,
          institution: chunk.institution || '',
          year: chunk.year || 2023,
          chunks: [],
        });
      }
      docMap.get(key)!.chunks.push(chunk.chunk_text);
    }

    console.log(`  Found ${docMap.size} unique documents from ${chunks.length} chunks`);

    const analyses: DocumentAnalysis[] = [];
    let analyzed = 0;

    for (const [key, doc] of docMap) {
      const fullText = doc.chunks.join('\n\n');
      if (fullText.length < 200) continue;

      try {
        const analysis = analyzeDocument(fullText, {
          title: doc.title,
          institution: doc.institution,
          institutionType: instType,
          year: doc.year,
          documentType: 'other',
        });
        analyses.push(analysis);
        analyzed++;
      } catch (err: any) {
        // skip malformed docs
      }
    }

    console.log(`  Analyzed ${analyzed} documents`);

    if (analyses.length > 0) {
      const aggregate = aggregateAnalyses(analyses);
      saveBlueprint(aggregate);

      console.log(`  Blueprint generated for ${sourceName}:`);
      console.log(`    Avg chapters: ${aggregate.structuralAverages.avgChapterCount}`);
      console.log(`    Avg sections/chapter: ${aggregate.structuralAverages.avgSectionsPerChapter.join(', ')}`);
      console.log(`    Ghanaian sources: ${aggregate.citationAverages.avgGhanaianSourcesPercent}%`);
      console.log(`    Avg references: ${aggregate.citationAverages.avgTotalReferences}`);
      console.log(`    Avg citation age: ${aggregate.citationAverages.avgCitationAge} years`);
      console.log(`    Top institutions: ${aggregate.citationAverages.topInstitutions.slice(0, 5).join(', ')}`);
    }
  }

  console.log('\n=== Blueprint Generation Complete ===');
}

analyzeHarvestedData().catch(console.error);
