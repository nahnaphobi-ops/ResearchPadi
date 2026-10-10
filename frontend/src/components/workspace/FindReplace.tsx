import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { findMatches, replaceAll, replaceMatch, setSearchHighlights, type SearchMatch } from './search';

interface Props {
  editor: Editor;
  mode: 'find' | 'replace';
  onModeChange: (mode: 'find' | 'replace') => void;
  onClose: () => void;
  notify: (message: string) => void;
}

export default function FindReplace({ editor, mode, onModeChange, onClose, notify }: Props) {
  const [query, setQuery] = useState(() => {
    const { from, to, empty } = editor.state.selection;
    const selected = empty ? '' : editor.state.doc.textBetween(from, to, ' ');
    return selected.length <= 80 ? selected : '';
  });
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [current, setCurrent] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.select(); }, [mode]);

  // Re-run the search whenever the query, options or the document change.
  useEffect(() => {
    const run = () => {
      const found = findMatches(editor.state.doc, query, { matchCase, wholeWord });
      setMatches(found);
      setCurrent((c) => (found.length ? Math.min(c, found.length - 1) : 0));
    };
    run();
    editor.on('update', run);
    return () => { editor.off('update', run); };
  }, [editor, query, matchCase, wholeWord]);

  useEffect(() => {
    setSearchHighlights(editor, matches, current);
  }, [editor, matches, current]);

  // Clear highlights when the panel closes.
  useEffect(() => () => { setSearchHighlights(editor, [], 0); }, [editor]);

  const goTo = useCallback((index: number) => {
    if (!matches.length) return;
    const i = (index + matches.length) % matches.length;
    setCurrent(i);
    const m = matches[i];
    editor.chain().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
  }, [editor, matches]);

  const replaceCurrent = () => {
    const m = matches[current];
    if (!m) return;
    replaceMatch(editor, m, replacement);
  };

  const replaceEverything = () => {
    const count = replaceAll(editor, matches, replacement);
    notify(count ? `Replaced ${count} ${count === 1 ? 'match' : 'matches'}.` : 'Nothing to replace.');
  };

  return (
    <div
      className="absolute right-3 top-3 z-40 w-[min(340px,calc(100%-24px))] bg-white border border-[#c8c6c4] rounded shadow-[0_8px_24px_rgba(0,0,0,0.18)] no-print"
      role="search"
      aria-label="Find and replace"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); editor.commands.focus(); } }}
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex gap-3 text-[12.5px]" role="tablist">
          {(['find', 'replace'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => onModeChange(m)}
              className={`pb-1 border-b-2 ${mode === m ? 'border-[#2b579a] text-[#252423] font-semibold' : 'border-transparent text-[#605e5c] hover:text-[#252423]'}`}
            >
              {m === 'find' ? 'Find' : 'Replace'}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded text-[#605e5c] hover:bg-[#edebe9]" aria-label="Close find and replace">
          <X size={15} />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goTo(e.shiftKey ? current - 1 : current + (matches.length && editor.state.selection.from === matches[current]?.from ? 1 : 0)); } }}
            placeholder="Search document"
            aria-label="Find what"
            className="flex-1 min-w-0 h-8 px-2 text-[13px] border border-[#8a8886] rounded-sm"
          />
          <button type="button" onClick={() => goTo(current - 1)} disabled={!matches.length} className="h-8 w-8 grid place-items-center rounded hover:bg-[#edebe9] disabled:opacity-40" aria-label="Previous match"><ChevronUp size={16} /></button>
          <button type="button" onClick={() => goTo(current + 1)} disabled={!matches.length} className="h-8 w-8 grid place-items-center rounded hover:bg-[#edebe9] disabled:opacity-40" aria-label="Next match"><ChevronDown size={16} /></button>
        </div>
        <p className="text-[11.5px] text-[#605e5c] h-4" aria-live="polite">
          {query ? (matches.length ? `${current + 1} of ${matches.length} ${matches.length === 1 ? 'result' : 'results'}` : 'No results') : ''}
        </p>

        {mode === 'replace' && (
          <>
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Replace with"
              aria-label="Replace with"
              className="w-full h-8 px-2 text-[13px] border border-[#8a8886] rounded-sm"
            />
            <div className="flex gap-1 justify-end">
              <button type="button" onClick={replaceCurrent} disabled={!matches.length} className="h-7 px-3 text-[12px] border border-[#8a8886] rounded-sm hover:bg-[#edebe9] disabled:opacity-40">Replace</button>
              <button type="button" onClick={replaceEverything} disabled={!matches.length} className="h-7 px-3 text-[12px] bg-[#2b579a] text-white rounded-sm hover:bg-[#1e4580] disabled:opacity-40">Replace All</button>
            </div>
          </>
        )}

        <div className="flex gap-4 pt-1 text-[12px] text-[#323130]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} className="accent-[#2b579a]" />
            Match case
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} className="accent-[#2b579a]" />
            Whole words only
          </label>
        </div>
      </div>
    </div>
  );
}
