import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import { Eye, Loader2, MessageSquarePlus } from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo';
import { workspaceExtensions } from '../components/workspace/editorSetup';
import { locateAnchor, occurrenceAt } from '../components/workspace/review/reviewMarks';
import { showCommentMarks } from '../components/workspace/comments/commentMarks';
import CommentThreads from '../components/workspace/comments/CommentThreads';
import { sharedService, type DocComment, type SharedDocument as Shared } from '../services/sharingService';
import { apiErrorMessage } from '../utils/apiError';

const NAME_KEY = 'rp-commenter-name';
const savedName = () => {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
};

/**
 * A document opened from a share link: read it, and (on a comment link) select
 * text to comment, with your name. No account needed.
 */
export default function SharedDocument() {
  const { token = '' } = useParams<{ token: string }>();
  const [shared, setShared] = useState<Shared | null>(null);
  const [comments, setComments] = useState<DocComment[]>([]);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<{ text: string; from: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState(savedName);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const editor = useEditor({
    extensions: workspaceExtensions({ placeholder: '' }),
    editable: false,
    content: '',
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      const text = from !== to ? ed.state.doc.textBetween(from, to, ' ').trim() : '';
      setSelection(text ? { text: text.slice(0, 500), from } : null);
    },
  });

  useEffect(() => {
    sharedService.open(token)
      .then(({ data }) => {
        setShared(data);
        setComments(data.comments);
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not open this link.')));
  }, [token]);

  useEffect(() => {
    if (editor && shared) editor.commands.setContent(shared.document.content);
  }, [editor, shared]);

  useEffect(() => {
    if (!editor || !shared) return;
    const anchors = comments.filter((c) => !c.parent_id && !c.resolved_at && c.anchor_text).map((c) => ({ id: c.id, anchor_text: c.anchor_text, occurrence: c.occurrence }));
    showCommentMarks(editor, anchors, activeId);
  }, [editor, shared, comments, activeId]);

  const remember = (value: string) => {
    setName(value);
    try { localStorage.setItem(NAME_KEY, value); } catch { /* optional */ }
  };

  const post = useCallback(async (body: { body: string; anchorText?: string; occurrence?: number; parentId?: string }) => {
    const { data } = await sharedService.comment(token, { ...body, name: name.trim() });
    setComments((list) => [...list, data.comment]);
    return data.comment;
  }, [token, name]);

  const add = async () => {
    if (!editor || !selection || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      const c = await post({ body: draft.trim(), anchorText: selection.text, occurrence: occurrenceAt(editor, selection.text, selection.from) });
      setDraft('');
      setActiveId(c.id);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your comment.'));
    } finally {
      setSending(false);
    }
  };

  const reply = async (parent: DocComment, body: string) => {
    try {
      await post({ body, parentId: parent.id });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your reply.'));
    }
  };

  const select = (c: DocComment) => {
    setActiveId(c.id);
    if (!editor || !c.anchor_text) return;
    const range = locateAnchor(editor, { id: c.id, anchor_text: c.anchor_text, occurrence: c.occurrence });
    if (range) editor.chain().setTextSelection(range).scrollIntoView().run();
  };

  const canComment = shared?.role === 'comment' || shared?.role === 'edit';

  return (
    <div className="min-h-screen bg-[#f3f2f1]">
      <header className="flex items-center justify-between gap-3 border-b border-rule bg-white px-4 py-3">
        <Link to="/" aria-label="ResearchPadi home"><BrandLogo /></Link>
        {shared && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-mist px-3 py-1 text-xs font-semibold text-navy">
            {canComment ? <MessageSquarePlus size={13} /> : <Eye size={13} />} {canComment ? 'You can comment' : 'View only'}
          </span>
        )}
      </header>

      {error && !shared && (
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-rule bg-white p-6 text-center">
          <p className="font-semibold text-navy">{error}</p>
          <p className="mt-1 text-sm text-muted">Ask the writer for a new link.</p>
        </div>
      )}
      {!shared && !error && <p className="mt-16 flex items-center justify-center gap-2 text-muted"><Loader2 size={16} className="animate-spin" /> Opening the document…</p>}

      {shared && (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 lg:flex-row lg:items-start">
          <main className="min-w-0 flex-1 rounded-lg border border-rule bg-white px-6 py-8 shadow-soft sm:px-12">
            <p className="text-xs text-muted">Shared by {shared.owner} · last saved {new Date(shared.document.updatedAt).toLocaleString()}</p>
            <h1 className="mt-1 mb-6 text-2xl font-bold text-navy">{shared.document.title}</h1>
            <div className="word-doc font-serif text-[15px] leading-relaxed"><EditorContent editor={editor} /></div>
          </main>

          {canComment && (
            <aside className="w-full space-y-3 lg:sticky lg:top-4 lg:w-80" aria-label="Comments">
              <div className="space-y-2 rounded-lg border border-rule bg-white p-3 text-sm">
                <p className="font-semibold text-navy">Comment</p>
                <input value={name} onChange={(e) => remember(e.target.value)} placeholder="Your name (e.g. Dr. Owusu)" aria-label="Your name" className="w-full rounded-md border border-[#c8c6c4] px-2 py-1.5" />
                {selection ? (
                  <>
                    <p className="line-clamp-2 text-xs italic text-muted">On “{selection.text}”</p>
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="Your comment" placeholder="Your comment…" className="w-full rounded-md border border-[#c8c6c4] px-2 py-1.5" />
                    <button type="button" onClick={() => void add()} disabled={sending || !draft.trim() || name.trim().length < 2} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                      <MessageSquarePlus size={13} /> {sending ? 'Saving…' : 'Comment'}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-muted">Select text in the document to comment on it.</p>
                )}
                {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
              </div>
              <CommentThreads comments={comments} activeId={activeId} onSelect={select} onReply={name.trim().length >= 2 ? reply : undefined} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
