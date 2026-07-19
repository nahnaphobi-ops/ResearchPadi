import { Router, Request, Response } from 'express';
import { analyzeDocument, validateClaim, extractClaims } from '../services/ai/claim-validator.service.js';
import { checkGrammar, getGrammarSummary } from '../services/ai/grammar-engine.service.js';
import { checkPlagiarism } from '../services/ai/plagiarism-checker.service.js';
import { detectAIContent, getDisclosureTemplates, getDisclosureTemplate } from '../services/ai/ai-detector.service.js';
import { getCitationStyles, formatCitation, generateBibliography, Citation } from '../services/ai/citation-styles.service.js';
import { processPDF, findRelevantChunks, getPdfStore, removePdf } from '../services/ai/pdf-chat.service.js';
import { requireAdmin } from '../middleware/admin.middleware.js';
import { upload } from '../middleware/upload.middleware.js';

const router = Router();

router.post('/validate-claims', requireAdmin, async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const analyses = await analyzeDocument(text);
    const summary = {
      total: analyses.length,
      high: analyses.filter(a => a.confidence === 'high').length,
      medium: analyses.filter(a => a.confidence === 'medium').length,
      low: analyses.filter(a => a.confidence === 'low').length,
      unsupported: analyses.filter(a => a.confidence === 'unsupported').length,
    };
    res.json({ summary, analyses });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Claim validation failed' });
  }
});

router.post('/validate-single-claim', requireAdmin, async (req: Request, res: Response) => {
  const { claim } = req.body;
  if (!claim) return res.status(400).json({ error: 'Claim is required' });
  try {
    const analysis = await validateClaim(claim);
    res.json(analysis);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Claim validation failed' });
  }
});

router.post('/check-grammar', requireAdmin, async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const issues = checkGrammar(text);
    const summary = getGrammarSummary(issues);
    res.json({ summary, issues });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Grammar check failed' });
  }
});

router.post('/check-plagiarism', requireAdmin, async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const report = await checkPlagiarism(text);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Plagiarism check failed' });
  }
});

router.post('/detect-ai', requireAdmin, async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const result = detectAIContent(text);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI detection failed' });
  }
});

router.get('/disclosure-templates', requireAdmin, (req: Request, res: Response) => {
  const { category } = req.query;
  const templates = getDisclosureTemplates(category as string | undefined);
  res.json({ templates });
});

router.get('/disclosure-templates/:id', requireAdmin, (req: Request, res: Response) => {
  const template = getDisclosureTemplate(req.params.id as string);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

router.get('/citation-styles', requireAdmin, (req: Request, res: Response) => {
  const styles = getCitationStyles();
  res.json({ styles });
});

router.post('/format-citation', requireAdmin, (req: Request, res: Response) => {
  const { citation, style, page } = req.body;
  if (!citation) return res.status(400).json({ error: 'Citation data is required' });
  try {
    const formatted = formatCitation(citation as Citation, style || 'apa-ghana', page);
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Citation formatting failed' });
  }
});

router.post('/generate-bibliography', requireAdmin, (req: Request, res: Response) => {
  const { citations, style } = req.body;
  if (!citations || !Array.isArray(citations)) {
    return res.status(400).json({ error: 'Citations array is required' });
  }
  try {
    const bibliography = generateBibliography(citations, style || 'apa-ghana');
    res.json({ bibliography });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Bibliography generation failed' });
  }
});

router.post('/pdf/upload', requireAdmin, async (req: Request, res: Response) => {
  const { fileName, text } = req.body;
  if (!fileName || !text) {
    return res.status(400).json({ error: 'fileName and text are required' });
  }
  try {
    const fileId = `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pdf = await processPDF(fileId, fileName, text);
    res.json({
      id: pdf.id,
      name: pdf.name,
      chunks: pdf.chunks.length,
      pages: Math.max(...pdf.chunks.map(c => c.pageNumber)),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'PDF processing failed' });
  }
});

router.post('/pdf/chat', requireAdmin, async (req: Request, res: Response) => {
  const { pdfIds, question } = req.body;
  if (!pdfIds || !Array.isArray(pdfIds) || !question) {
    return res.status(400).json({ error: 'pdfIds array and question are required' });
  }
  try {
    const relevantChunks = await findRelevantChunks(question, pdfIds);
    const context = relevantChunks.map(c =>
      `[${c.pdfName}, p.${c.pageNumber}]: ${c.relevantText}`
    ).join('\n\n');

    res.json({
      sources: relevantChunks,
      context: context.substring(0, 3000),
      message: `Found ${relevantChunks.length} relevant passages from ${new Set(relevantChunks.map(c => c.pdfName)).size} PDF(s)`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'PDF chat failed' });
  }
});

router.get('/pdf/list', requireAdmin, (req: Request, res: Response) => {
  const store = getPdfStore();
  const pdfs = Array.from(store.values()).map(pdf => ({
    id: pdf.id,
    name: pdf.name,
    chunks: pdf.chunks.length,
    uploadedAt: pdf.uploadedAt,
  }));
  res.json({ pdfs });
});

router.delete('/pdf/:id', requireAdmin, (req: Request, res: Response) => {
  const removed = removePdf(req.params.id as string);
  if (!removed) return res.status(404).json({ error: 'PDF not found' });
  res.json({ message: 'PDF removed' });
});

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    features: [
      'claim-validation',
      'grammar-checking',
      'plagiarism-checking',
      'ai-detection',
      'citation-formatting',
      'pdf-chat',
    ],
  });
});

export default router;
