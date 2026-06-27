import axios from 'axios';
import { PDFParse } from 'pdf-parse';
import { generateEmbedding } from './embedder.service';
import { chunkText } from './chunker.service';
import { supabase } from '../../db/supabase';
import { CONFIG } from '../../config';
import { uploadFile, getPublicUrl } from '../../lib/storage';
import { childLogger } from '../../lib/logger';

const log = childLogger('ingester');

export interface DocumentToIngest {
  identifier: string;
  title: string;
  authors: string[];
  date: string;
  description: string;
  subjects: string[];
  institution: string;
  sourceName: string;
  sourceUrl: string;
  fullText?: string;
  pdfUrl?: string;
}

export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse();
    const data = await parser.parseBuffer(pdfBuffer);
    return data.text || '';
  } catch (err: any) {
    log.error({ err: err.message }, 'PDF extraction failed');
    return '';
  }
}

export async function downloadPdf(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'ResearchPadi-Harvester/1.0',
      },
    });
    return Buffer.from(response.data);
  } catch (err: any) {
    log.error({ url, err: err.message }, 'PDF download failed');
    return null;
  }
}

export async function ingestDocument(doc: DocumentToIngest): Promise<{ success: boolean; chunksStored: number }> {
  try {
    const textToProcess = doc.fullText || doc.description;
    if (!textToProcess || textToProcess.trim().length < 50) {
      return { success: false, chunksStored: 0 };
    }

    const existingCheck = await supabase
      .from('knowledge_chunks')
      .select('id')
      .eq('source_url', doc.sourceUrl)
      .limit(1);

    if (existingCheck.data && existingCheck.data.length > 0) {
      return { success: false, chunksStored: 0 };
    }

    const year = doc.date ? parseInt(doc.date.substring(0, 4)) : null;
    const chunks = chunkText(textToProcess, CONFIG.RAG.CHUNK_SIZE, CONFIG.RAG.CHUNK_OVERLAP);
    let chunksStored = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.trim().length < 20) continue;

      const embedding = await generateEmbedding(chunk);

      const insertData: Record<string, unknown> = {
        document_title: doc.title,
        authors: doc.authors.join(', '),
        year: year,
        institution: doc.institution,
        field: doc.subjects[0] || 'General',
        source_name: doc.sourceName,
        source_url: doc.sourceUrl,
        chunk_text: chunk,
        chunk_index: i,
      };

      if (embedding) {
        insertData.embedding = embedding;
      }

      const { error } = await supabase
        .from('knowledge_chunks')
        .insert(insertData);

      if (error) {
        log.debug({ chunk: i, title: doc.title, err: error.message }, 'Chunk insert failed');
      } else {
        chunksStored++;
      }
    }

    return { success: true, chunksStored };
  } catch (err: any) {
    log.error({ title: doc.title, err: err.message }, 'Document ingest failed');
    return { success: false, chunksStored: 0 };
  }
}
