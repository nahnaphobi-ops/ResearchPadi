import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import type { Editor, Extensions } from '@tiptap/core';

/**
 * Real-time co-writing: the owner and co-writers with an edit link share one
 * Yjs document through the API's websocket (/api/collab). Only documents with
 * an edit link go live; everyone else's editor works as before.
 */
export interface Live {
  provider: HocuspocusProvider;
  doc: Y.Doc;
}

export interface LiveUser { name: string; color: string }

/** The websocket address. Vercel can't proxy websockets, so in production it is the API's own host. */
export function collabUrl(): string {
  const configured = import.meta.env.VITE_COLLAB_URL as string | undefined;
  if (configured) return configured;
  const api = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
  if (/^https?:\/\//.test(api)) return `${api.replace(/^http/, 'ws').replace(/\/$/, '')}/collab`;
  if (import.meta.env.PROD) return 'wss://researchpadi.onrender.com/api/collab';
  return `${location.origin.replace(/^http/, 'ws')}/api/collab`;
}

const COLORS = ['#d13438', '#0078d4', '#107c10', '#8764b8', '#ca5010', '#038387', '#c239b3', '#986f0b'];
export const colorFor = (seed: string) => COLORS[[...seed].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % COLORS.length];

/** Joins the live document; a co-writer passes their edit link. */
export function joinLive(sessionId: string, opts: { shareToken?: string; onDenied?: (reason: string) => void } = {}): Live {
  const doc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: collabUrl(),
    name: sessionId,
    document: doc,
    // Read on every (re)connect, so a fresh sign-in is picked up.
    token: () => [localStorage.getItem('token') ?? '', opts.shareToken].filter(Boolean).join(' '),
    onAuthenticationFailed: ({ reason }) => opts.onDenied?.(reason),
  });
  return { provider, doc };
}

export function leaveLive(live: Live | null) {
  if (!live) return;
  live.provider.destroy();
  live.doc.destroy();
}

export function liveExtensions(live: Live, user: LiveUser): Extensions {
  return [
    Collaboration.configure({ document: live.doc }),
    CollaborationCaret.configure({ provider: live.provider, user }),
  ];
}

/**
 * The first person into a new live document fills it with the saved text.
 * Runs once the document has synced with the server, so it never doubles
 * text someone else already put there.
 */
export function seedWhenSynced(live: Live, editor: Editor, html: () => string) {
  // Only the live editor: the one it replaces may still be around for a render.
  if (editor.isDestroyed || !editor.extensionManager.extensions.some((e) => e.name === 'collaboration')) return;
  const seed = () => {
    if (editor.isDestroyed || !html()) return;
    if (live.doc.getXmlFragment('default').length === 0) editor.commands.setContent(html());
  };
  if (live.provider.isSynced) seed();
  else live.provider.on('synced', function once() {
    live.provider.off('synced', once);
    seed();
  });
}

/** Who else is in the document right now. */
export function othersHere(live: Live): LiveUser[] {
  const self = live.provider.awareness?.clientID;
  const users: LiveUser[] = [];
  live.provider.awareness?.getStates().forEach((state, id) => {
    if (id !== self && state.user?.name) users.push(state.user as LiveUser);
  });
  return users;
}

const editorIds = new WeakMap<object, number>();
let lastEditorId = 0;
/**
 * A React key per editor instance. Going live (or leaving) replaces the
 * editor, and everything bound to it should mount afresh with the new one
 * rather than keep listeners on the old, destroyed one.
 */
export function editorKey(editor: object | null): number {
  if (!editor) return 0;
  if (!editorIds.has(editor)) editorIds.set(editor, ++lastEditorId);
  return editorIds.get(editor)!;
}
