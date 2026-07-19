import { generateEmbedding } from '../rag/embedder.service.js';
import { supabase } from '../../db/supabase.js';
import { CONFIG } from '../../config/index.js';

export interface UploadedPDF {
  id: string;
  name: string;
  text: string;
  chunks: PDFChunk[];
  uploadedAt: Date;
}

export interface PDFChunk {
  pdfId: string;
  pageNumber: number;
  text: string;
  index: number;
}

export interface PDFChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: PDFSource[];
}

export interface PDFSource {
  pdfId: string;
  pdfName: string;
  pageNumber: number;
  relevantText: string;
  relevance: number;
}

const pdfStore = new Map<string, UploadedPDF>();

export async function processPDF(
  fileId: string,
  fileName: string,
  text: string
): Promise<UploadedPDF> {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: PDFChunk[] = [];

  let pageNumber = 1;
  let charCount = 0;
  const CHARS_PER_PAGE = 3000;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (para.length < 10) continue;

    if (charCount + para.length > CHARS_PER_PAGE * pageNumber) {
      pageNumber++;
    }
    charCount += para.length;

    chunks.push({
      pdfId: fileId,
      pageNumber,
      text: para,
      index: chunks.length,
    });
  }

  const pdf: UploadedPDF = {
    id: fileId,
    name: fileName,
    text,
    chunks,
    uploadedAt: new Date(),
  };

  pdfStore.set(fileId, pdf);
  return pdf;
}

export async function findRelevantChunks(
  query: string,
  pdfIds: string[],
  maxChunks: number = 10
): Promise<PDFSource[]> {
  const allChunks: PDFSource[] = [];

  for (const pdfId of pdfIds) {
    const pdf = pdfStore.get(pdfId);
    if (!pdf) continue;

    const queryEmbedding = await generateEmbedding(query);

    for (const chunk of pdf.chunks) {
      let relevance = 0;

      if (queryEmbedding) {
        const chunkEmbedding = await generateEmbedding(chunk.text);
        if (chunkEmbedding) {
          relevance = cosineSimilarity(queryEmbedding, chunkEmbedding);
        }
      }

      if (relevance < 0.3) {
        const queryWords = query.toLowerCase().split(/\s+/);
        const chunkWords = chunk.text.toLowerCase();
        const matches = queryWords.filter(w => chunkWords.includes(w)).length;
        relevance = matches / queryWords.length * 0.5;
      }

      if (relevance > 0.1) {
        allChunks.push({
          pdfId,
          pdfName: pdf.name,
          pageNumber: chunk.pageNumber,
          relevantText: chunk.text.substring(0, 500),
          relevance,
        });
      }
    }
  }

  return allChunks
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxChunks);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function getPdfStore(): Map<string, UploadedPDF> {
  return pdfStore;
}

export function getPdf(fileId: string): UploadedPDF | undefined {
  return pdfStore.get(fileId);
}

export function removePdf(fileId: string): boolean {
  return pdfStore.delete(fileId);
}
