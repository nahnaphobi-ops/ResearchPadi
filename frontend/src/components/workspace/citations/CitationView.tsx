import { useEffect, useId, useRef, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { ExternalLink, Trash2, X } from 'lucide-react';
import type { CitationMode, Source } from './types';

function shortAuthors(s: Source) {
  const a = s.authors;
  if (!a.length) return 'Unknown author';
  if (a.length === 1) return a[0].family;
  if (a.length === 2) return `${a[0].family} & ${a[1].family}`;
  return `${a[0].family} et al.`;
}

/** In-document citation chip; click to edit page numbers, form, or sources. */
export default function CitationView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const pageId = useId();
  const sources = (node.attrs.sources ?? []) as Source[];
  const label = (node.attrs.label as string) || '(citation)';
  const page = (node.attrs.page as string) ?? '';
  const mode = (node.attrs.mode as CitationMode) ?? 'parenthetical';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, editor]);

  return (
    <NodeViewWrapper as="span" ref={ref} className="relative inline">
      <span
        role="button"
        tabIndex={-1}
        contentEditable={false}
        title={sources.map((s) => `${shortAuthors(s)} (${s.year ?? 'n.d.'}) — ${s.title}`).join('\n')}
        onClick={() => editor.isEditable && setOpen((o) => !o)}
        className={`citation-chip ${selected || open ? 'is-active' : ''}`}
      >
        {label}
      </span>

      {open && (
        <span
          contentEditable={false}
          className="citation-popover no-print"
          role="dialog"
          aria-label="Edit citation"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-[#252423]">Edit citation</span>
            <button type="button" onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-[#edebe9]" aria-label="Close">
              <X size={14} />
            </button>
          </span>

          <span className="block space-y-1.5 mb-3 max-h-[160px] overflow-y-auto">
            {sources.map((s) => (
              <span key={s.id} className="flex items-start gap-2 text-[11.5px] leading-snug">
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[#252423]">{shortAuthors(s)} ({s.year ?? 'n.d.'})</span>
                  <span className="block text-[#605e5c] line-clamp-2">{s.title}</span>
                </span>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="p-0.5 text-[#605e5c] hover:text-[#2b579a]" aria-label="Open source" title="Open source">
                    <ExternalLink size={13} />
                  </a>
                )}
                {sources.length > 1 && (
                  <button
                    type="button"
                    onClick={() => updateAttributes({ sources: sources.filter((x) => x.id !== s.id) })}
                    className="p-0.5 text-[#605e5c] hover:text-[#a4262c]"
                    aria-label={`Remove ${shortAuthors(s)} from this citation`}
                    title="Remove from this citation"
                  >
                    <X size={13} />
                  </button>
                )}
              </span>
            ))}
          </span>

          <label className="block text-[11.5px] text-[#605e5c] mb-1" htmlFor={pageId}>Page(s)</label>
          <input
            id={pageId}
            value={page}
            onChange={(e) => updateAttributes({ page: e.target.value.slice(0, 30) })}
            placeholder="e.g. 23 or 23–25"
            className="w-full h-7 px-2 mb-3 text-[12px] border border-[#8a8886] rounded-sm"
          />

          <span className="block text-[11.5px] text-[#605e5c] mb-1">Form</span>
          <span className="flex gap-1 mb-3" role="radiogroup">
            {([
              ['parenthetical', '(Author, Year)'],
              ['narrative', 'Author (Year)'],
            ] as const).map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => updateAttributes({ mode: value })}
                className={`flex-1 h-7 text-[11.5px] rounded-sm border ${mode === value ? 'border-[#2b579a] bg-[#deecf9] text-[#1b3a6b]' : 'border-[#c8c6c4] hover:bg-[#edebe9]'}`}
              >
                {text}
              </button>
            ))}
          </span>

          <span className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => { deleteNode(); editor.commands.focus(); }}
              className="inline-flex items-center gap-1 text-[11.5px] text-[#a4262c] hover:underline"
            >
              <Trash2 size={12} /> Delete citation
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-7 px-3 text-[12px] bg-[#2b579a] text-white rounded-sm hover:bg-[#1e4580]">
              Done
            </button>
          </span>
        </span>
      )}
    </NodeViewWrapper>
  );
}
