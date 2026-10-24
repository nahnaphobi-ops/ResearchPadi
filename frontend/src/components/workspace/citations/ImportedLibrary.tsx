import { useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Quote, Trash2, Upload } from 'lucide-react';
import { workspaceService } from '../../../services/workspaceService';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { apiErrorMessage } from '../../../utils/apiError';
import { MAX_IMPORT, parseReferences } from './importRefs';
import type { Source } from './types';

interface Props {
  editor: Editor | null;
  sessionId: string;
}

const isImported = (s: unknown): s is Source =>
  Boolean(s && typeof s === 'object' && (s as Source).origin === 'imported' && typeof (s as Source).title === 'string' && Array.isArray((s as Source).authors));

/**
 * References brought in from Zotero, Mendeley or EndNote (BibTeX or RIS),
 * kept with this document and cited in one click.
 */
export default function ImportedLibrary({ editor, sessionId }: Props) {
  const { activeSession, setActiveSession } = useWorkspaceStore();
  const library = useMemo(() => (activeSession?.sources_used ?? []).filter(isImported), [activeSession]);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (next: Source[]) => {
    const others = (activeSession?.sources_used ?? []).filter((s) => !isImported(s));
    const sourcesUsed = [...others, ...next];
    await workspaceService.updateSession(sessionId, { sources_used: sourcesUsed });
    if (activeSession) setActiveSession({ ...activeSession, sources_used: sourcesUsed });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setMessage('');
    try {
      const found = parseReferences(await file.text());
      if (!found.length) {
        setError('No references found. Export from Zotero or Mendeley as BibTeX (.bib) or RIS (.ris).');
        return;
      }
      const known = new Set(library.map((s) => s.id));
      const added = found.filter((s) => !known.has(s.id));
      await save([...library, ...added].slice(0, MAX_IMPORT));
      setMessage(`Added ${added.length} reference${added.length === 1 ? '' : 's'}${found.length > added.length ? ` (${found.length - added.length} already here)` : ''}.`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not import that file.'));
    }
  };

  const remove = async (s: Source) => {
    try {
      await save(library.filter((x) => x.id !== s.id));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove it.'));
    }
  };

  const q = filter.trim().toLowerCase();
  const shown = q ? library.filter((s) => `${s.title} ${s.authors.map((a) => a.family).join(' ')} ${s.year ?? ''}`.toLowerCase().includes(q)) : library;

  return (
    <div className="p-3 space-y-2.5">
      <input ref={fileRef} type="file" accept=".bib,.ris,.txt,.bibtex" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-1.5 h-8 text-[12.5px] font-semibold text-[#2b579a] border border-[#2b579a]/40 rounded-sm hover:bg-[#deecf9]">
        <Upload size={14} /> Import from Zotero or Mendeley
      </button>
      <p className="text-[11px] leading-relaxed text-[#605e5c]">In Zotero: File › Export Library › BibTeX. In Mendeley: select references › Export › BibTeX or RIS.</p>
      {message && <p className="text-[11.5px] text-[#0b6a0b]">{message}</p>}
      {error && <p role="alert" className="text-[11.5px] text-[#a4262c]">{error}</p>}
      {library.length > 6 && (
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter your library" aria-label="Filter your library" className="w-full h-7 px-2 text-[12px] border border-[#c8c6c4] rounded-sm" />
      )}
      {!library.length && <p className="text-[12px] text-[#8a8886]">No imported references yet.</p>}
      <ul className="space-y-1.5">
        {shown.map((s) => (
          <li key={s.id} className="group rounded-sm border border-[#edebe9] px-2 py-1.5">
            <p className="text-[12px] font-medium leading-snug text-[#252423]">{s.title}</p>
            <p className="text-[11px] text-[#8a8886] truncate">{[s.authors[0]?.family + (s.authors.length > 2 ? ' et al.' : s.authors.length === 2 ? ` & ${s.authors[1].family}` : ''), s.year ?? 'n.d.', s.containerTitle].filter(Boolean).join(' · ')}</p>
            <div className="mt-1 flex gap-3">
              <button type="button" disabled={!editor} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().insertCitation([s]).run()} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#2b579a] hover:underline disabled:opacity-40">
                <Quote size={12} /> Cite at cursor
              </button>
              <button type="button" onClick={() => void remove(s)} className="inline-flex items-center gap-1 text-[11.5px] text-[#a4262c] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:underline">
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
