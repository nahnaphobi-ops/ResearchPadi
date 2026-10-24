import crypto from 'crypto';
import { supabase } from '../../db/supabase.js';

/**
 * Version history, share links and comments for Workspace documents
 * (tables from supabase/migrations/20261024000000_workspace_sharing.sql).
 * Until that migration is applied, every call fails with a SharingError that
 * says so, instead of a database error.
 */
export class SharingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const NOT_SET_UP = 'Sharing, comments and version history are not set up on this server yet.';

function check(error: { code?: string; message?: string } | null, fallback: string): void {
  if (!error) return;
  // 42P01 / PGRST205: the table doesn't exist (migration not applied).
  if (error.code === '42P01' || error.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(error.message ?? '')) {
    throw new SharingError(NOT_SET_UP, 503);
  }
  throw new SharingError(fallback, 500);
}

export const wordCount = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').split(/\s+/).filter(Boolean).length;

// ── Versions ───────────────────────────────────────────────────────────────

const MAX_VERSIONS = 60;
/** An automatic version is kept at most this often while someone writes. */
export const AUTO_VERSION_MS = 15 * 60_000;

export interface VersionSummary { id: string; created_at: string; word_count: number; label: string | null; user_id: string | null }

export async function listVersions(sessionId: string): Promise<VersionSummary[]> {
  const { data, error } = await supabase
    .from('workspace_versions')
    .select('id, created_at, word_count, label, user_id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(MAX_VERSIONS);
  check(error, 'Could not load the version history.');
  return (data ?? []) as VersionSummary[];
}

export async function getVersion(sessionId: string, versionId: string): Promise<{ id: string; content: string; created_at: string; label: string | null }> {
  const { data, error } = await supabase
    .from('workspace_versions')
    .select('id, content, created_at, label')
    .eq('session_id', sessionId)
    .eq('id', versionId)
    .maybeSingle();
  check(error, 'Could not load that version.');
  if (!data) throw new SharingError('That version no longer exists.', 404);
  return data as any;
}

export async function saveVersion(sessionId: string, userId: string | null, content: string, label: string | null = null): Promise<VersionSummary> {
  const { data, error } = await supabase
    .from('workspace_versions')
    .insert({ session_id: sessionId, user_id: userId, content, word_count: wordCount(content), label: label?.slice(0, 80) || null })
    .select('id, created_at, word_count, label, user_id')
    .single();
  check(error, 'Could not save a version.');
  // Keep the newest MAX_VERSIONS.
  const { data: old } = await supabase
    .from('workspace_versions')
    .select('id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .range(MAX_VERSIONS, MAX_VERSIONS + 50);
  if (old?.length) await supabase.from('workspace_versions').delete().in('id', old.map((v) => v.id));
  return data as VersionSummary;
}

/**
 * After a save: keep an automatic version if the last one is older than
 * AUTO_VERSION_MS and the content changed. Never fails the save.
 */
export async function autoVersion(sessionId: string, userId: string | null, content: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('workspace_versions')
      .select('content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return;
    if (data && (Date.now() - Date.parse(data.created_at) < AUTO_VERSION_MS || data.content === content)) return;
    if (!content.trim()) return;
    await saveVersion(sessionId, userId, content);
  } catch {
    // Version history is a convenience: a failure here never blocks saving.
  }
}

// ── Share links ────────────────────────────────────────────────────────────

export type ShareRole = 'view' | 'comment' | 'edit';
export const isShareRole = (v: unknown): v is ShareRole => v === 'view' || v === 'comment' || v === 'edit';

export interface Share { id: string; token: string; role: ShareRole; created_at: string }

export async function listShares(sessionId: string): Promise<Share[]> {
  const { data, error } = await supabase
    .from('workspace_shares')
    .select('id, token, role, created_at')
    .eq('session_id', sessionId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  check(error, 'Could not load your share links.');
  return (data ?? []) as Share[];
}

export async function createShare(sessionId: string, role: ShareRole): Promise<Share> {
  const token = crypto.randomBytes(18).toString('base64url');
  const { data, error } = await supabase
    .from('workspace_shares')
    .insert({ session_id: sessionId, token, role })
    .select('id, token, role, created_at')
    .single();
  check(error, 'Could not create the link.');
  return data as Share;
}

export async function revokeShare(sessionId: string, shareId: string): Promise<void> {
  const { error } = await supabase
    .from('workspace_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('id', shareId);
  check(error, 'Could not turn off that link.');
}

/** The link's document, if the link still works. */
export async function openShare(token: string): Promise<{ share: Share & { session_id: string }; session: { id: string; title: string; content: string; user_id: string; updated_at: string } }> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new SharingError('This link is not valid.', 404);
  const { data: share, error } = await supabase
    .from('workspace_shares')
    .select('id, token, role, created_at, session_id, revoked_at')
    .eq('token', token)
    .maybeSingle();
  check(error, 'Could not open this link.');
  if (!share || share.revoked_at) throw new SharingError('This link has been turned off or does not exist.', 404);
  const { data: session } = await supabase
    .from('workspace_sessions')
    .select('id, title, content, user_id, updated_at')
    .eq('id', share.session_id)
    .maybeSingle();
  if (!session) throw new SharingError('The document has been deleted.', 404);
  return { share: share as any, session: session as any };
}

// ── Comments ───────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string;
  anchor_text: string;
  occurrence: number;
  body: string;
  resolved_at: string | null;
  created_at: string;
}

const COMMENT_COLUMNS = 'id, parent_id, author_id, author_name, anchor_text, occurrence, body, resolved_at, created_at';

export async function listComments(sessionId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('workspace_comments')
    .select(COMMENT_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(500);
  check(error, 'Could not load the comments.');
  return (data ?? []) as Comment[];
}

export interface NewComment {
  authorId: string | null;
  authorName: string;
  shareId?: string | null;
  parentId?: string | null;
  anchorText?: string;
  occurrence?: number;
  body: string;
}

export function cleanComment(raw: any): Omit<NewComment, 'authorId' | 'authorName' | 'shareId'> {
  const body = typeof raw?.body === 'string' ? raw.body.trim().slice(0, 2_000) : '';
  if (!body) throw new SharingError('Write a comment first.');
  const parentId = typeof raw?.parentId === 'string' && /^[0-9a-f-]{36}$/i.test(raw.parentId) ? raw.parentId : null;
  const anchorText = typeof raw?.anchorText === 'string' ? raw.anchorText.slice(0, 500) : '';
  if (!parentId && !anchorText.trim()) throw new SharingError('Select the text you want to comment on.');
  const occurrence = Number.isInteger(raw?.occurrence) && raw.occurrence >= 0 ? Math.min(raw.occurrence, 10_000) : 0;
  return { body, parentId, anchorText: parentId ? '' : anchorText, occurrence };
}

export async function addComment(sessionId: string, c: NewComment): Promise<Comment> {
  if (c.parentId) {
    const { data: parent } = await supabase.from('workspace_comments').select('id').eq('session_id', sessionId).eq('id', c.parentId).maybeSingle();
    if (!parent) throw new SharingError('The comment you are replying to was deleted.', 404);
  }
  const { data, error } = await supabase
    .from('workspace_comments')
    .insert({
      session_id: sessionId,
      share_id: c.shareId ?? null,
      author_id: c.authorId,
      author_name: c.authorName.slice(0, 60),
      parent_id: c.parentId ?? null,
      anchor_text: c.anchorText ?? '',
      occurrence: c.occurrence ?? 0,
      body: c.body,
    })
    .select(COMMENT_COLUMNS)
    .single();
  check(error, 'Could not save the comment.');
  return data as Comment;
}

export async function setResolved(sessionId: string, commentId: string, resolved: boolean): Promise<void> {
  const { error } = await supabase
    .from('workspace_comments')
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq('session_id', sessionId)
    .eq('id', commentId);
  check(error, 'Could not update the comment.');
}

export async function deleteComment(sessionId: string, commentId: string): Promise<void> {
  const { error } = await supabase.from('workspace_comments').delete().eq('session_id', sessionId).eq('id', commentId);
  check(error, 'Could not delete the comment.');
}
