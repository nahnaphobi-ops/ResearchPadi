import jwt from 'jsonwebtoken';
import { supabase } from '../../db/supabase.js';
import { CONFIG } from '../../config/index.js';
import { openShare } from './sharing.service.js';

/**
 * Real-time co-writing. A document is live once its owner hands out an "edit"
 * link: the owner and anyone signed in with that link edit the same Yjs
 * document over a websocket. Its state is kept in workspace_collab; when the
 * last edit link is turned off the state is dropped, so the HTML the owner goes
 * on editing alone is again the only copy.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CollabDenied extends Error {}

export interface CollabUser { id: string; name: string; role: 'owner' | 'editor' }

/** Is there a working edit link for this document? */
export async function hasEditShare(sessionId: string): Promise<boolean> {
  const { count } = await supabase
    .from('workspace_shares')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('role', 'edit')
    .is('revoked_at', null);
  return (count ?? 0) > 0;
}

/**
 * Who may join the live document: its owner, or a signed-in user holding a
 * working edit link to it. Throws CollabDenied otherwise.
 */
export async function authorize(documentName: string, token: string, shareToken: string | null): Promise<CollabUser> {
  if (!UUID.test(documentName)) throw new CollabDenied('Unknown document.');
  let userId: string;
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET, { algorithms: ['HS256'] }) as { id?: string };
    if (!decoded?.id) throw new Error('no id');
    userId = decoded.id;
  } catch {
    throw new CollabDenied('Sign in again to keep editing.');
  }

  const { data: session } = await supabase.from('workspace_sessions').select('user_id').eq('id', documentName).maybeSingle();
  if (!session) throw new CollabDenied('The document has been deleted.');
  const { data: user } = await supabase.from('users').select('full_name').eq('id', userId).maybeSingle();
  const name = (user?.full_name as string | undefined)?.trim() || 'Co-writer';

  if (session.user_id === userId) return { id: userId, name, role: 'owner' };
  if (!shareToken) throw new CollabDenied('Ask the writer for an edit link.');
  const { share } = await openShare(shareToken).catch(() => { throw new CollabDenied('This link has been turned off.'); });
  if (share.session_id !== documentName || share.role !== 'edit') throw new CollabDenied('This link does not allow editing.');
  return { id: userId, name, role: 'editor' };
}

export async function loadState(sessionId: string): Promise<Uint8Array | null> {
  const { data } = await supabase.from('workspace_collab').select('state').eq('session_id', sessionId).maybeSingle();
  return data?.state ? new Uint8Array(Buffer.from(data.state as string, 'base64')) : null;
}

/** Saved only while the document is still shared for editing, so a turned-off link can't bring old state back. */
export async function storeState(sessionId: string, state: Uint8Array): Promise<void> {
  if (!(await hasEditShare(sessionId))) return;
  const { error } = await supabase
    .from('workspace_collab')
    .upsert({ session_id: sessionId, state: Buffer.from(state).toString('base64'), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function dropState(sessionId: string): Promise<void> {
  await supabase.from('workspace_collab').delete().eq('session_id', sessionId);
}
