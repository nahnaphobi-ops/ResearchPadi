import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import * as workspaceAssist from '../services/ai/workspace-assist.service.js';
import { checkGrammar, getGrammarSummary } from '../services/ai/grammar-engine.service.js';
import { extractClaims, validateClaim, analyzeDocument } from '../services/ai/claim-validator.service.js';
import { checkPlagiarism } from '../services/ai/plagiarism-checker.service.js';
import { detectAIContent } from '../services/ai/ai-detector.service.js';
import { getCitationStyles, getCitationStyle } from '../services/ai/citation-styles.service.js';
import { retrieveContext } from '../services/rag/retriever.service.js';
import { childLogger } from '../lib/logger.js';

const log = childLogger('workspace');

// CRUD: List sessions
export const listSessions = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await supabase
    .from('workspace_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// CRUD: Create session
export const createSession = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { title, course, institution_type } = req.body;

  const { data, error } = await supabase
    .from('workspace_sessions')
    .insert({
      user_id: userId,
      title: title || 'Untitled Session',
      course: course || '',
      institution_type: institution_type || '',
      content: '',
      sources_used: [],
      uploaded_materials: [],
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// CRUD: Get session
export const getSession = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const { data, error } = await supabase
    .from('workspace_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) return res.status(404).json({ error: 'Session not found' });
  res.json(data);
};

// CRUD: Update session
export const updateSession = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { id } = req.params;
  const updates = req.body;

  const allowed = ['title', 'content', 'course', 'institution_type', 'sources_used'];
  const safeUpdates: Record<string, any> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }
  safeUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('workspace_sessions')
    .update(safeUpdates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Session not found' });
  res.json(data);
};

// CRUD: Delete session
export const deleteSession = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const { error } = await supabase
    .from('workspace_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Session deleted' });
};

// AI Assistance
export const assist = async (req: Request, res: Response) => {
  const { selectedText, instruction, context, sessionId } = req.body;
  const subscription = (req as any).subscription;

  if (!instruction) return res.status(400).json({ error: 'Instruction is required' });

  // Build context from session if provided
  let fullContext = context || '';
  if (sessionId && !fullContext) {
    const { data: session } = await supabase
      .from('workspace_sessions')
      .select('content, title')
      .eq('id', sessionId)
      .maybeSingle();
    if (session?.content) {
      fullContext = `Paper title: ${session.title}\nCurrent draft:\n${session.content.substring(0, 2000)}`;
    }
  }

  const result = await workspaceAssist.assistWithText(
    selectedText || '',
    instruction,
    fullContext,
    subscription?.plan
  );

  res.json(result);
};

// Search citations
export const searchCitations = async (req: Request, res: Response) => {
  const { topic, query, format } = req.body;
  if (!topic && !query) return res.status(400).json({ error: 'Topic or query is required' });

  const results = await workspaceAssist.searchCitations(topic, query, format);
  res.json(results);
};

// Advanced assist: grammar, claims, plagiarism, AI detect, RAG-enhanced writing
export const assistAdvanced = async (req: Request, res: Response) => {
  const { action, text, fullDocument, sessionId } = req.body;

  if (!action) return res.status(400).json({ error: 'Action is required' });
  if (!text && !fullDocument) return res.status(400).json({ error: 'Text or fullDocument is required' });

  const content = text || fullDocument || '';

  try {
    switch (action) {
      case 'grammar': {
        const issues = checkGrammar(content);
        const summary = getGrammarSummary(issues);
        return res.json({ action: 'grammar', issues, summary });
      }

      case 'claims': {
        const analyses = await analyzeDocument(content);
        return res.json({ action: 'claims', analyses });
      }

      case 'validate-claim': {
        if (!text) return res.status(400).json({ error: 'Text is required for claim validation' });
        const analysis = await validateClaim(text);
        return res.json({ action: 'validate-claim', analysis });
      }

      case 'plagiarism': {
        const report = await checkPlagiarism(content);
        return res.json({ action: 'plagiarism', report });
      }

      case 'ai-detect': {
        const result = detectAIContent(content);
        return res.json({ action: 'ai-detect', result });
      }

      case 'rag-enhance': {
        // Retrieve relevant local sources for the selected text
        const sources = await retrieveContext(content);
        // Build a context-enhanced prompt
        const sourceContext = (sources || [])
          .slice(0, 5)
          .map((s: any) => `- ${s.document_title || 'Untitled'} (${s.authors || 'Unknown'}, ${s.year || 'n.d.'}): ${s.chunk_text?.substring(0, 200) || ''}`)
          .join('\n');

        let fullContext = '';
        if (sessionId) {
          const { data: session } = await supabase
            .from('workspace_sessions')
            .select('content, title')
            .eq('id', sessionId)
            .maybeSingle();
          if (session?.content) {
            fullContext = `Paper title: ${session.title}\nCurrent draft:\n${session.content.substring(0, 2000)}`;
          }
        }

        const response = await workspaceAssist.assistWithText(
          content,
          'expand',
          `${fullContext}\n\nRelevant local sources:\n${sourceContext}`,
          undefined
        );
        return res.json({ action: 'rag-enhance', response, sources: (sources || []).slice(0, 5) });
      }

      case 'suggest-citations': {
        const sources = await retrieveContext(content);
        return res.json({
          action: 'suggest-citations',
          suggestions: (sources || []).slice(0, 8).map((s: any) => ({
            title: s.document_title,
            authors: s.authors,
            year: s.year,
            institution: s.institution,
            sourceUrl: s.source_url,
            relevantText: s.chunk_text?.substring(0, 300),
          })),
        });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    log.error({ action, err: err.message }, 'Advanced assist error');
    return res.status(500).json({ error: err.message || 'Advanced assist failed' });
  }
};

// Get available citation styles
export const listCitationStyles = async (_req: Request, res: Response) => {
  const styles = getCitationStyles();
  res.json({ styles });
};

// Search local RAG citations
export const searchLocalCitations = async (req: Request, res: Response) => {
  const { query, format } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const sources = await retrieveContext(query);
    const style = getCitationStyle(format || 'apa-ghana');

    const citations = (sources || []).map((s: any) => {
      const authors = s.authors ? s.authors.split(',').map((a: string) => a.trim()) : ['Unknown'];
      const citation = {
        title: s.document_title || 'Untitled',
        authors,
        year: s.year || 0,
        institution: s.institution || '',
        url: s.source_url || '',
      };

      let formatted = '';
      if (style) {
        formatted = style.bibliography(citation);
      } else {
        formatted = `${authors.join(', ')} (${citation.year}). ${citation.title}.`;
      }

      return {
        ...citation,
        authors: s.authors,
        relevantText: s.chunk_text?.substring(0, 300),
        formatted,
      };
    });

    res.json({ citations: citations.slice(0, 20) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Search failed' });
  }
};
