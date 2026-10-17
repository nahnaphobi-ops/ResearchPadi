import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { childLogger } from '../lib/logger.js';
import { lazySse } from '../lib/sse.js';
import { aiStream } from '../services/ai/gateway.service.js';
import { ExtractError, extractDocx, extractPdf, extractUrl } from '../services/notebook/extract.service.js';
import {
  NotebookError, addSource, deleteSource, listSources, ownSession, searchSources, sourceDigest, updateSource,
  type SourceExcerpt, type SourceKind,
} from '../services/notebook/notebook.service.js';
import { NOTEBOOK_SYSTEM_PROMPT, SUGGESTIONS_PROMPT, buildChatPrompt, buildOutputPrompt, isNotebookOutput } from '../services/notebook/notebook-ai.js';
import { detectSourceDetails, parseSuggestions } from '../services/notebook/metadata.service.js';
import { aiCall } from '../services/ai/gateway.service.js';
import { cacheGet } from '../lib/cache.js';
import { parseAuthors, serializeAuthors } from '../lib/authors.js';

const log = childLogger('notebook-controller');

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const FILE_KINDS: Record<string, SourceKind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'txt',
};

function fileKind(file: Express.Multer.File): SourceKind | null {
  const byType = FILE_KINDS[file.mimetype];
  if (byType) return byType;
  const ext = file.originalname.toLowerCase().split('.').pop();
  return ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ext === 'txt' || ext === 'md' ? 'txt' : null;
}

const multerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } }).single('file');

/** Accepts an optional `file` field; turns multer's errors into 400s. */
export function notebookUpload(req: Request, res: Response, next: NextFunction) {
  multerUpload(req, res, (err: unknown) => {
    if (!err) return next();
    const tooBig = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
    res.status(400).json({ error: tooBig ? 'Files can be up to 15 MB.' : 'Could not read the upload.' });
  });
}

function handleError(res: Response, err: unknown, fallback: string) {
  if (err instanceof NotebookError || err instanceof ExtractError) return res.status(err.status).json({ error: err.message });
  log.error({ err: (err as Error)?.message }, fallback);
  return res.status(500).json({ error: fallback });
}

const userOf = (req: Request) => (req as any).user?.id as string;

/** Source ids the student ticked for chat and outputs (empty means all). */
function chosenSources(body: any): string[] | undefined {
  const ids = Array.isArray(body?.sourceIds) ? body.sourceIds.filter((id: unknown) => typeof id === 'string').slice(0, 50) : [];
  return ids.length ? ids : undefined;
}

/** A work from the ResearchPadi library (findSources result) as notebook text. */
function libraryEntry(raw: any): { title: string; text: string; url: string | null; authors: string | null; year: number | null } | null {
  const title = typeof raw?.title === 'string' ? raw.title.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  const snippet = typeof raw?.snippet === 'string' ? raw.snippet.trim() : '';
  if (!title) return null;
  const names = Array.isArray(raw?.authors)
    ? raw.authors.map((a: any) => (a?.given ? `${a.family}, ${a.given}` : a?.family)).filter((n: unknown) => typeof n === 'string' && n)
    : [];
  const authors = serializeAuthors(parseAuthors(names.join('; '))) || null;
  const year = Number.isInteger(raw?.year) ? raw.year : null;
  const url = typeof raw?.url === 'string' && /^https?:\/\//.test(raw.url) ? raw.url : null;
  const venue = [raw?.containerTitle, raw?.institution, raw?.repository].filter((v) => typeof v === 'string' && v).join(' · ');
  const text = [title, authors && `Authors: ${authors}`, year && `Year: ${year}`, venue && `Published in: ${venue}`, snippet && `Abstract: ${snippet}`]
    .filter(Boolean).join('\n');
  return { title, text, url, authors, year };
}

export const list = async (req: Request, res: Response) => {
  try {
    await ownSession(req.params.id as string, userOf(req));
    res.json({ sources: await listSources(req.params.id as string) });
  } catch (err) {
    handleError(res, err, 'Could not load sources');
  }
};

export const add = async (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  try {
    await ownSession(sessionId, userOf(req));
    const body = req.body ?? {};
    let source;

    if (req.file) {
      const kind = fileKind(req.file);
      if (!kind) return res.status(400).json({ error: 'Upload a PDF, Word (.docx) or text file.' });
      const text = kind === 'pdf' ? await extractPdf(req.file.buffer)
        : kind === 'docx' ? await extractDocx(req.file.buffer)
        : req.file.buffer.toString('utf8');
      // Fill in title, authors and year from the first page so the source can be cited straight away.
      const details = kind === 'txt' ? {} : await detectSourceDetails(text, userOf(req));
      const title = (typeof body.title === 'string' && body.title.trim()) || details.title || req.file.originalname.replace(/\.[^.]+$/, '');
      source = await addSource(sessionId, userOf(req), { kind, title, text, authors: details.authors, year: details.year });
    } else if (body.library && typeof body.library === 'object') {
      const entry = libraryEntry(body.library);
      if (!entry) return res.status(400).json({ error: 'That library entry has no title.' });
      source = await addSource(sessionId, userOf(req), { kind: entry.url ? 'url' : 'text', ...entry });
    } else if (typeof body.url === 'string' && body.url.trim()) {
      const page = await extractUrl(body.url.trim());
      const details = await detectSourceDetails(page.text, userOf(req));
      source = await addSource(sessionId, userOf(req), { kind: page.kind, title: page.title || details.title || body.url.trim(), text: page.text, url: body.url.trim(), authors: details.authors, year: details.year });
    } else if (typeof body.text === 'string' && body.text.trim()) {
      const title = (typeof body.title === 'string' && body.title.trim()) || body.text.trim().split('\n')[0].slice(0, 80);
      source = await addSource(sessionId, userOf(req), { kind: 'text', title, text: body.text });
    } else {
      return res.status(400).json({ error: 'Add a file, a link or some text.' });
    }
    res.status(201).json({ source });
  } catch (err) {
    handleError(res, err, 'Could not add the source');
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    await ownSession(req.params.id as string, userOf(req));
    res.json({ source: await updateSource(req.params.id as string, req.params.sourceId as string, req.body ?? {}) });
  } catch (err) {
    handleError(res, err, 'Could not update the source');
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await ownSession(req.params.id as string, userOf(req));
    await deleteSource(req.params.id as string, req.params.sourceId as string);
    res.status(204).end();
  } catch (err) {
    handleError(res, err, 'Could not remove the source');
  }
};

/** What the client needs to show and insert a citation for each numbered source. */
function citationList(excerpts: SourceExcerpt[]) {
  return excerpts.map((e) => ({
    n: e.n,
    sourceId: e.source.id,
    title: e.source.title,
    authors: e.source.authors,
    year: e.source.year,
    url: e.source.url,
    kind: e.source.kind,
    snippet: e.passages[0]?.slice(0, 280) ?? '',
  }));
}

async function streamAnswer(
  req: Request,
  res: Response,
  excerpts: SourceExcerpt[],
  prompt: string,
  tier: 'light' | 'drafting',
  action: string,
) {
  const sse = lazySse(req, res);
  try {
    const result = await aiStream(
      {
        prompt,
        tier,
        systemPrompt: NOTEBOOK_SYSTEM_PROMPT,
        cachePrompt: true,
        maxTokens: tier === 'light' ? 2_000 : 4_000,
        userId: userOf(req),
        signal: sse.signal,
        meta: { action },
      },
      (delta) => {
        if (!sse.started) sse.send('sources', { sources: citationList(excerpts) });
        sse.send('delta', { text: delta });
      },
    );
    sse.send('done', { truncated: result.truncated });
    res.end();
  } catch (err: any) {
    log.warn({ action, err: err.message }, 'Notebook AI failed');
    const status = err.status || 502;
    sse.fail(status, status === 429 || status === 502 ? err.message : 'The AI could not finish that. Please try again.');
  }
}

export const chat = async (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) return res.status(400).json({ error: 'Ask a question.' });
  const history = Array.isArray(req.body?.history)
    ? req.body.history
        .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
        .map((m: any) => ({ role: m.role, content: m.content }))
    : [];

  try {
    const { title } = await ownSession(sessionId, userOf(req));
    const excerpts = await searchSources(sessionId, question, 10, chosenSources(req.body));
    if (!excerpts.length) return res.status(400).json({ error: 'Add a source first, then ask about it.' });
    // Grounded Q&A over short excerpts: the light tier answers well and cheaply.
    await streamAnswer(req, res, excerpts, buildChatPrompt(question, excerpts, history, title), 'light', 'notebook:chat');
  } catch (err) {
    if (!res.headersSent) handleError(res, err, 'Could not answer from your sources');
  }
};

export const generate = async (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  const kind = req.body?.kind;
  if (!isNotebookOutput(kind)) return res.status(400).json({ error: 'Unknown output type.' });

  try {
    const { title } = await ownSession(sessionId, userOf(req));
    const excerpts = (await sourceDigest(sessionId, 60_000, chosenSources(req.body))).filter((e) => e.passages.length);
    if (!excerpts.length) return res.status(400).json({ error: 'Add a source first.' });
    await streamAnswer(req, res, excerpts, buildOutputPrompt(kind, excerpts, title), 'drafting', `notebook:${kind}`);
  } catch (err) {
    if (!res.headersSent) handleError(res, err, 'Could not create that from your sources');
  }
};

/** Three questions grounded in the student's sources (cached until the sources change). */
export const suggestions = async (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  try {
    await ownSession(sessionId, userOf(req));
    const digest = (await sourceDigest(sessionId, 6_000)).filter((e) => e.passages.length);
    if (!digest.length) return res.json({ questions: [] });
    const key = `nb-suggest:${sessionId}:${digest.map((e) => e.source.id).join(',')}`;
    const questions = await cacheGet(key, 6 * 3600, async () => {
      const excerpts = digest.map((e) => `[${e.n}] ${e.source.title}\n${e.passages.join(' ').slice(0, 600)}`).join('\n\n');
      const result = await aiCall({ prompt: `${SUGGESTIONS_PROMPT}\n\nEXCERPTS:\n${excerpts}`, tier: 'light', maxTokens: 300, userId: userOf(req), meta: { action: 'notebook:suggest' } });
      const parsed = parseSuggestions(result.text);
      if (!parsed.length) throw new Error('No usable suggestions'); // don't cache an empty answer
      return parsed;
    });
    res.json({ questions });
  } catch (err) {
    // Suggestions are optional; the panel falls back to its default starters.
    log.warn({ err: (err as Error)?.message }, 'Could not suggest questions');
    res.json({ questions: [] });
  }
};
