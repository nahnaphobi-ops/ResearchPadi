import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Loader2, MessageSquarePlus, RefreshCw, Share2 } from 'lucide-react';
import { sharingService, type DocComment } from '../../../services/sharingService';
import { apiErrorMessage } from '../../../utils/apiError';
import { locateAnchor, occurrenceAt } from '../review/reviewMarks';
import { showCommentMarks } from './commentMarks';
import CommentThreads from './CommentThreads';

interface Props {
  editor: Editor | null;
  sessionId: string;
  onShare: () => void;
}

/**
 * Comments on the document: the writer's own notes, and comments from people
 * they shared a link with. Commented passages are highlighted in the text.
 */
export default function CommentsPanel({ editor, sessionId, onShare }: Props) {
  const [comments, setComments] = useState<DocComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const selection = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null;
      const { from, to } = ed.state.selection;
      const text = from !== to ? ed.state.doc.textBetween(from, to, ' ').trim() : '';
      return text ? { text: text.slice(0, 500), from } : null;
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await sharingService.comments(sessionId);
      setComments(data.comments);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the comments.'));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    sharingService.comments(sessionId)
      .then(({ data }) => { if (!cancelled) setComments(data.comments); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load the comments.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  // Highlight the passages of open comments; clear them when the panel closes.
  useEffect(() => {
    if (!editor) return;
    const anchors = comments.filter((c) => !c.parent_id && !c.resolved_at && c.anchor_text).map((c) => ({ id: c.id, anchor_text: c.anchor_text, occurrence: c.occurrence }));
    showCommentMarks(editor, anchors, activeId);
    return () => showCommentMarks(editor, []);
  }, [editor, comments, activeId]);

  const select = (c: DocComment) => {
    setActiveId(c.id);
    if (!editor || !c.anchor_text) return;
    const range = locateAnchor(editor, { id: c.id, anchor_text: c.anchor_text, occurrence: c.occurrence });
    if (range) editor.chain().setTextSelection(range).scrollIntoView().run();
  };

  const add = async () => {
    if (!editor || !selection || !draft.trim()) return;
    try {
      const { data } = await sharingService.comment(sessionId, { body: draft.trim(), anchorText: selection.text, occurrence: occurrenceAt(editor, selection.text, selection.from) });
      setComments((list) => [...list, data.comment]);
      setDraft('');
      setActiveId(data.comment.id);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the comment.'));
    }
  };

  const reply = async (parent: DocComment, body: string) => {
    try {
      const { data } = await sharingService.comment(sessionId, { body, parentId: parent.id });
      setComments((list) => [...list, data.comment]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the reply.'));
    }
  };

  const resolve = async (c: DocComment, resolved: boolean) => {
    try {
      await sharingService.resolve(sessionId, c.id, resolved);
      setComments((list) => list.map((x) => (x.id === c.id ? { ...x, resolved_at: resolved ? new Date().toISOString() : null } : x)));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the comment.'));
    }
  };

  const remove = async (c: DocComment) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await sharingService.removeComment(sessionId, c.id);
      setComments((list) => list.filter((x) => x.id !== c.id && x.parent_id !== c.id));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the comment.'));
    }
  };

  const resolvedCount = comments.filter((c) => !c.parent_id && c.resolved_at).length;

  return (
    <div className="p-3 space-y-3 text-[12.5px]">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-[13px] text-[#252423]">Comments</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void load()} aria-label="Refresh comments" title="Refresh" className="rounded p-1 text-[#605e5c] hover:bg-[#f3f2f1]"><RefreshCw size={14} /></button>
          <button type="button" onClick={onShare} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#2b579a] hover:bg-[#eff6fc]"><Share2 size={13} /> Share</button>
        </div>
      </div>

      <div className="rounded-lg border border-[#e1dfdd] p-2.5 space-y-1.5">
        {selection ? (
          <>
            <p className="line-clamp-2 text-[11.5px] italic text-[#605e5c]">On “{selection.text}”</p>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} aria-label="New comment" placeholder="Add a comment or a note to yourself…" className="w-full rounded-md border border-[#c8c6c4] px-2 py-1.5 outline-none focus:border-[#2b579a]" />
            <button type="button" onClick={() => void add()} disabled={!draft.trim()} className="inline-flex items-center gap-1 rounded-md bg-[#2b579a] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-40"><MessageSquarePlus size={13} /> Comment</button>
          </>
        ) : (
          <p className="text-[11.5px] text-[#605e5c]">Select some text in the document to comment on it. Share a link to let your supervisor or classmates comment too.</p>
        )}
      </div>

      {error && <p role="alert" className="text-[12px] text-[#a4262c]">{error}</p>}
      {loading ? (
        <p className="flex items-center gap-1.5 text-[#605e5c]"><Loader2 size={13} className="animate-spin" /> Loading…</p>
      ) : (
        <CommentThreads comments={comments} activeId={activeId} onSelect={select} onReply={reply} onResolve={resolve} onDelete={remove} showResolved={showResolved} />
      )}
      {resolvedCount > 0 && (
        <button type="button" onClick={() => setShowResolved((v) => !v)} className="text-[11.5px] text-[#605e5c] hover:underline">
          {showResolved ? 'Hide' : 'Show'} {resolvedCount} resolved
        </button>
      )}
    </div>
  );
}
