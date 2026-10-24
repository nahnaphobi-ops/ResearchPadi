import { useState } from 'react';
import { Check, CornerDownRight, RotateCcw, Trash2 } from 'lucide-react';
import type { DocComment } from '../../../services/sharingService';

interface Props {
  comments: DocComment[];
  activeId?: string | null;
  onSelect?: (c: DocComment) => void;
  onReply?: (parent: DocComment, body: string) => Promise<void>;
  onResolve?: (c: DocComment, resolved: boolean) => Promise<void>;
  onDelete?: (c: DocComment) => Promise<void>;
  showResolved?: boolean;
}

const when = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Comments on passages, each with its replies. */
export default function CommentThreads({ comments, activeId, onSelect, onReply, onResolve, onDelete, showResolved = false }: Props) {
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const roots = comments.filter((c) => !c.parent_id && (showResolved || !c.resolved_at));
  const repliesTo = (id: string) => comments.filter((c) => c.parent_id === id);

  const sendReply = async (parent: DocComment) => {
    if (!onReply || !reply.trim()) return;
    setBusy(true);
    try {
      await onReply(parent, reply.trim());
      setReply('');
      setReplying(null);
    } finally {
      setBusy(false);
    }
  };

  if (!roots.length) return <p className="text-[12px] text-[#8a8886]">No comments yet.</p>;

  return (
    <div className="space-y-2">
      {roots.map((c) => (
        <div
          key={c.id}
          onClick={() => onSelect?.(c)}
          className={`rounded-lg border p-2.5 text-[12.5px] ${onSelect ? 'cursor-pointer' : ''} ${activeId === c.id ? 'border-[#f59e0b] bg-[#fffbeb]' : 'border-[#e1dfdd] bg-white'} ${c.resolved_at ? 'opacity-60' : ''}`}
        >
          {c.anchor_text && <p className="mb-1 line-clamp-2 border-l-2 border-[#f59e0b] pl-2 text-[11.5px] italic text-[#605e5c]">“{c.anchor_text}”</p>}
          {[c, ...repliesTo(c.id)].map((m, i) => (
            <div key={m.id} className={i ? 'mt-2 pl-3 border-l border-[#e1dfdd]' : ''}>
              <p className="text-[11px] text-[#8a8886]"><span className="font-semibold text-[#323130]">{m.author_name}</span> · {when(m.created_at)}</p>
              <p className="whitespace-pre-wrap text-[#252423]">{m.body}</p>
              {onDelete && i > 0 && (
                <button type="button" onClick={(e) => { e.stopPropagation(); void onDelete(m); }} className="text-[11px] text-[#a4262c] hover:underline">Delete</button>
              )}
            </div>
          ))}
          <div className="mt-1.5 flex flex-wrap gap-3" onClick={(e) => e.stopPropagation()}>
            {onReply && !c.resolved_at && (
              <button type="button" onClick={() => setReplying(replying === c.id ? null : c.id)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#2b579a] hover:underline">
                <CornerDownRight size={12} /> Reply
              </button>
            )}
            {onResolve && (
              <button type="button" onClick={() => void onResolve(c, !c.resolved_at)} className="inline-flex items-center gap-1 text-[11.5px] text-[#323130] hover:underline">
                {c.resolved_at ? <><RotateCcw size={12} /> Reopen</> : <><Check size={12} /> Resolve</>}
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={() => void onDelete(c)} className="inline-flex items-center gap-1 text-[11.5px] text-[#a4262c] hover:underline">
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
          {replying === c.id && (
            <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} autoFocus aria-label="Reply" placeholder="Write a reply…" className="w-full rounded-md border border-[#c8c6c4] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#2b579a]" />
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => setReplying(null)} className="rounded px-2 py-1 text-[12px] hover:bg-[#f3f2f1]">Cancel</button>
                <button type="button" disabled={busy || !reply.trim()} onClick={() => void sendReply(c)} className="rounded bg-[#2b579a] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-40">Reply</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
