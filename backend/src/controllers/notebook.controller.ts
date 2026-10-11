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
import { NOTEBOOK_SYSTEM_PROMPT, buildChatPrompt, buildOutputPrompt, isNotebookOutput } from '../services/notebook/notebook-ai.js';

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
      const title = (typeof body.title === 'string' && body.title.trim()) || req.file.originalname.replace(/\.[^.]+$/, '');
      source = await addSource(sessionId, userOf(req), { kind, title, text });
    } else if (typeof body.url === 'string' && body.url.trim()) {
      const page = await extractUrl(body.url.trim());
      source = await addSource(sessionId, userOf(req), { kind: page.kind, title: page.title, text: page.text, url: body.url.trim() });
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
    const excerpts = await searchSources(sessionId, question);
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
    const excerpts = (await sourceDigest(sessionId)).filter((e) => e.passages.length);
    if (!excerpts.length) return res.status(400).json({ error: 'Add a source first.' });
    await streamAnswer(req, res, excerpts, buildOutputPrompt(kind, excerpts, title), 'drafting', `notebook:${kind}`);
  } catch (err) {
    if (!res.headersSent) handleError(res, err, 'Could not create that from your sources');
  }
};
