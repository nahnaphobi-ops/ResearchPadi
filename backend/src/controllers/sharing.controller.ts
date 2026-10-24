import type { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { childLogger } from '../lib/logger.js';
import {
  SharingError, addComment, cleanComment, createShare, deleteComment, getVersion, isShareRole, listComments, listShares,
  listVersions, openShare, revokeShare, saveVersion, setResolved,
} from '../services/workspace/sharing.service.js';

/**
 * Version history, share links and comments. The owner's routes sit under
 * /api/workspace/sessions/:id (signed in); /api/shared/:token serves people
 * who were given a link: view only, or view and comment (no account needed,
 * they give a name).
 */
const log = childLogger('sharing');
const userOf = (req: Request) => (req as any).user?.id as string;

function fail(res: Response, err: unknown, fallback: string) {
  if (err instanceof SharingError) return res.status(err.status).json({ error: err.message });
  log.warn({ err: (err as Error)?.message }, fallback);
  return res.status(500).json({ error: fallback });
}

/** The document, if it belongs to the signed-in user. */
async function ownDocument(req: Request): Promise<{ id: string; title: string; content: string }> {
  const { data } = await supabase
    .from('workspace_sessions')
    .select('id, title, content')
    .eq('id', req.params.id as string)
    .eq('user_id', userOf(req))
    .maybeSingle();
  if (!data) throw new SharingError('Document not found.', 404);
  return data as any;
}

async function displayName(userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('full_name').eq('id', userId).maybeSingle();
  return (data?.full_name as string | undefined)?.trim() || 'Document owner';
}

// ── Versions ───────────────────────────────────────────────────────────────

export const versions = async (req: Request, res: Response) => {
  try {
    await ownDocument(req);
    res.json({ versions: await listVersions(req.params.id as string) });
  } catch (err) {
    fail(res, err, 'Could not load the version history.');
  }
};

export const version = async (req: Request, res: Response) => {
  try {
    await ownDocument(req);
    res.json({ version: await getVersion(req.params.id as string, req.params.versionId as string) });
  } catch (err) {
    fail(res, err, 'Could not load that version.');
  }
};

export const saveNamedVersion = async (req: Request, res: Response) => {
  try {
    const doc = await ownDocument(req);
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    res.status(201).json({ version: await saveVersion(doc.id, userOf(req), doc.content ?? '', label || null) });
  } catch (err) {
    fail(res, err, 'Could not save a version.');
  }
};

/** Brings back an old version, keeping the current text as a version first. */
export const restore = async (req: Request, res: Response) => {
  try {
    const doc = await ownDocument(req);
    const old = await getVersion(doc.id, req.params.versionId as string);
    await saveVersion(doc.id, userOf(req), doc.content ?? '', 'Before restoring an earlier version');
    const { data, error } = await supabase
      .from('workspace_sessions')
      .update({ content: old.content, updated_at: new Date().toISOString() })
      .eq('id', doc.id)
      .eq('user_id', userOf(req))
      .select()
      .single();
    if (error) throw new SharingError('Could not restore that version.', 500);
    res.json({ session: data });
  } catch (err) {
    fail(res, err, 'Could not restore that version.');
  }
};

// ── Share links (owner) ────────────────────────────────────────────────────

export const shares = async (req: Request, res: Response) => {
  try {
    await ownDocument(req);
    res.json({ shares: await listShares(req.params.id as string) });
  } catch (err) {
    fail(res, err, 'Could not load your share links.');
  }
};

export const share = async (req: Request, res: Response) => {
  try {
    await ownDocument(req);
    const role = req.body?.role;
    if (!isShareRole(role)) return res.status(400).json({ error: 'Choose who the link is for.' });
    res.status(201).json({ share: await createShare(req.params.id as string, role) });
  } catch (err) {
    fail(res, err, 'Could not create the link.');
  }
};

export const unshare = async (req: Request, res: Response) => {
  try {
    await ownDocument(req);
    await revokeShare(req.params.id as string, req.params.shareId as string);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, 'Could not turn off that link.');
  }
};

// ── Comments (owner) ───────────────────────────────────────────────────────

export const comments = async (req: Request, res: Response) => {
  try {
    await ownDocument(req);
    res.json({ comments: await listComments(req.params.id as string) });
  } catch (err) {
    fail(res, err, 'Could not load the comments.');
  }
};

export const comment = async (req: Request, res: Response) => {
  try {
    await ownDocument(req);
    const input = cleanComment(req.body);
    const created = await addComment(req.params.id as string, { ...input, authorId: userOf(req), authorName: await displayName(userOf(req)) });
    res.status(201).json({ comment: created });
  } catch (err) {
    fail(res, err, 'Could not save the comment.');
  }
};

export const updateComment = async (req: Request, res: Response) => {
  try {
    await ownDocument(req);
    await setResolved(req.params.id as string, req.params.commentId as string, Boolean(req.body?.resolved));
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, 'Could not update the comment.');
  }
};

export const removeComment = async (req: Request, res: Response) => {
  try {
    await ownDocument(req);
    await deleteComment(req.params.id as string, req.params.commentId as string);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, 'Could not delete the comment.');
  }
};

// ── Shared links (anyone with the link) ────────────────────────────────────

export const openShared = async (req: Request, res: Response) => {
  try {
    const { share: link, session } = await openShare(req.params.token as string);
    const withComments = link.role !== 'view';
    res.json({
      role: link.role,
      document: { title: session.title, content: session.content ?? '', updatedAt: session.updated_at },
      owner: await displayName(session.user_id),
      comments: withComments ? await listComments(session.id) : [],
    });
  } catch (err) {
    fail(res, err, 'Could not open this link.');
  }
};

export const commentShared = async (req: Request, res: Response) => {
  try {
    const { share: link, session } = await openShare(req.params.token as string);
    if (link.role === 'view') return res.status(403).json({ error: 'This link lets you read the document, not comment on it.' });
    const name = typeof req.body?.name === 'string' ? req.body.name.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    if (name.length < 2) return res.status(400).json({ error: 'Add your name so the writer knows who commented.' });
    const input = cleanComment(req.body);
    const created = await addComment(session.id, { ...input, authorId: (req as any).user?.id ?? null, authorName: name, shareId: link.id });
    res.status(201).json({ comment: created });
  } catch (err) {
    fail(res, err, 'Could not save the comment.');
  }
};
