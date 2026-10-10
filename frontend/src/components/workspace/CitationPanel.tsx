import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { BookMarked, Check, Copy, ExternalLink, Loader2, MapPin, Quote, Search, TextQuote } from 'lucide-react';
import { apiErrorMessage } from '../../utils/apiError';
import { workspaceService } from '../../services/workspaceService';
import { CITATION_STYLES, referencePreview, referenceText } from './citations/format';
import { getCitationStyle, getCitedSources, hasBibliography } from './citations/CitationExtension';
import type { CitationStyleId, Source } from './citations/types';

interface Props {
  editor: Editor | null;
  selectedText: string;
}

const YEAR_FILTERS = [
  { value: '', label: 'Any year' },
  { value: '2020', label: '2020 and later' },
  { value: '2015', label: '2015 and later' },
  { value: '2010', label: '2010 and later' },
];

function authorLine(s: Source) {
  const a = s.authors;
  const names = !a.length ? 'Unknown author' : a.length <= 2 ? a.map((n) => n.family).join(' & ') : `${a[0].family} et al.`;
  return [names, s.year ?? 'n.d.', s.containerTitle || s.repository].filter(Boolean).join(' · ');
}

function OriginBadge({ s }: { s: Source }) {
  if (s.origin === 'ghana-repository') {
    return <span className="px-1.5 py-0.5 rounded bg-[#dff6dd] text-[#0b6a0b] text-[10px] font-semibold">{s.repository ?? 'Ghanaian repository'}</span>;
  }
  if (s.ghanaian) return <span className="px-1.5 py-0.5 rounded bg-[#dff6dd] text-[#0b6a0b] text-[10px] font-semibold">Ghana-affiliated</span>;
  return <span className="px-1.5 py-0.5 rounded bg-[#f3f2f1] text-[#605e5c] text-[10px] font-semibold">{s.origin === 'openalex' ? 'OpenAlex' : 'Semantic Scholar'}</span>;
}

const TYPE_LABEL: Record<Source['type'], string> = {
  article: 'Article', thesis: 'Thesis', book: 'Book', chapter: 'Chapter', report: 'Report', conference: 'Conference', webpage: 'Web page', other: 'Other',
};

export default function CitationPanel({ editor, selectedText }: Props) {
  const [tab, setTab] = useState<'search' | 'document'>('search');
  const [query, setQuery] = useState('');
  const [ghanaFirst, setGhanaFirst] = useState(true);
  const [yearFrom, setYearFrom] = useState('');
  const [results, setResults] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const doc = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { style: 'apa7' as CitationStyleId, cited: [] as ReturnType<typeof getCitedSources>, bibliographyAt: null as number | null };
      return { style: getCitationStyle(e.state), cited: getCitedSources(e.state), bibliographyAt: hasBibliography(e.state) };
    },
  });
  const style = doc?.style ?? 'apa7';
  const cited = doc?.cited ?? [];
  const citedIds = new Set(cited.map((c) => c.source.id));

  const search = async (text = query) => {
    const q = text.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const res = await workspaceService.findSources({ query: q, ghanaFirst, yearFrom: yearFrom ? Number(yearFrom) : undefined });
      setResults(res.data.sources ?? []);
    } catch (err) {
      setError(apiErrorMessage(err, 'Search failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const useSelection = () => {
    const text = selectedText.replace(/\s+/g, ' ').trim().slice(0, 300);
    setQuery(text);
    void search(text);
  };

  const cite = (s: Source) => {
    if (!editor) return;
    editor.chain().focus().insertCitation([s]).run();
  };

  const copy = async (s: Source) => {
    try {
      await navigator.clipboard.writeText(referenceText(s, style));
      setCopied(s.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError('Your browser blocked copying. Select the reference text and press Ctrl+C.');
    }
  };

  const goTo = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setNodeSelection(pos).scrollIntoView().run();
  };

  return (
    <div className="flex flex-col h-full text-[#252423]">
      {/* Style + tabs */}
      <div className="px-3 pt-3 pb-2 border-b border-[#edebe9] space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="citation-style" className="text-[11.5px] text-[#605e5c] shrink-0">Style</label>
          <select
            id="citation-style"
            value={style}
            onChange={(e) => editor?.chain().focus().setCitationStyle(e.target.value as CitationStyleId).run()}
            className="flex-1 min-w-0 h-7 px-1.5 text-[12px] border border-[#8a8886] rounded-sm bg-white"
          >
            {CITATION_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex text-[12px]" role="tablist">
          {([
            ['search', 'Find sources'],
            ['document', `In this document (${cited.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex-1 pb-1.5 border-b-2 ${tab === key ? 'border-[#2b579a] font-semibold' : 'border-transparent text-[#605e5c] hover:text-[#252423]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'search' ? (
        <>
          <form
            className="p-3 space-y-2 border-b border-[#edebe9]"
            onSubmit={(e) => { e.preventDefault(); void search(); }}
          >
            <div className="flex gap-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Topic, keywords or a sentence to support"
                aria-label="Search for sources"
                className="flex-1 min-w-0 h-8 px-2 text-[12.5px] border border-[#8a8886] rounded-sm"
              />
              <button type="submit" disabled={loading || !query.trim()} className="h-8 w-9 grid place-items-center bg-[#2b579a] text-white rounded-sm hover:bg-[#1e4580] disabled:opacity-50" aria-label="Search">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              </button>
            </div>
            {selectedText.trim().length > 15 && (
              <button
                type="button"
                onClick={useSelection}
                className="w-full flex items-center gap-1.5 h-7 px-2 text-[11.5px] text-[#2b579a] border border-dashed border-[#2b579a]/50 rounded-sm hover:bg-[#deecf9]"
              >
                <TextQuote size={13} /> Find sources for the selected text
              </button>
            )}
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={ghanaFirst} onChange={(e) => setGhanaFirst(e.target.checked)} className="accent-[#2b579a]" />
                Ghanaian sources first
              </label>
              <select
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                aria-label="Publication year"
                className="h-6 px-1 text-[11.5px] border border-[#c8c6c4] rounded-sm bg-white"
              >
                {YEAR_FILTERS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto">
            {error && <p role="alert" className="m-3 p-2 text-[12px] text-[#a4262c] bg-[#fde7e9] rounded-sm">{error}</p>}

            {!searched && !loading && (
              <div className="p-5 text-center text-[12px] text-[#605e5c] space-y-2">
                <Quote size={22} className="mx-auto text-[#2b579a]" />
                <p className="font-semibold text-[#252423]">Cite as you write</p>
                <p>Searches UGSpace, KNUST, UCC, Ashesi and more, plus Ghana-affiliated journal research. Put your cursor where the citation should go, then click <b>Cite</b>.</p>
              </div>
            )}

            {loading && (
              <ul className="p-3 space-y-2" aria-hidden="true">
                {[0, 1, 2].map((i) => <li key={i} className="h-20 rounded bg-[#f3f2f1] animate-pulse" />)}
              </ul>
            )}

            {!loading && searched && !results.length && !error && (
              <p className="p-5 text-center text-[12px] text-[#605e5c]">No sources found. Try fewer or broader keywords.</p>
            )}

            {!loading && results.length > 0 && (
              <ul className="divide-y divide-[#edebe9]">
                {results.map((s) => {
                  const isCited = citedIds.has(s.id);
                  return (
                    <li key={s.id} className="p-3">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <OriginBadge s={s} />
                        <span className="px-1.5 py-0.5 rounded bg-[#f3f2f1] text-[#605e5c] text-[10px]">{s.genre && s.type === 'thesis' ? s.genre : TYPE_LABEL[s.type]}</span>
                        {s.openAccess && <span className="px-1.5 py-0.5 rounded bg-[#f3f2f1] text-[#605e5c] text-[10px]">Open access</span>}
                      </div>
                      <p className="text-[12.5px] font-semibold leading-snug line-clamp-2">{s.title}</p>
                      <p className="text-[11.5px] text-[#605e5c] mt-0.5 truncate">{authorLine(s)}</p>
                      {s.snippet && (
                        <button
                          type="button"
                          onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                          className={`mt-1 text-left text-[11.5px] text-[#323130] leading-snug ${expanded === s.id ? '' : 'line-clamp-2'}`}
                          title={expanded === s.id ? 'Show less' : 'Show more'}
                        >
                          {s.snippet}
                        </button>
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => cite(s)}
                          disabled={!editor}
                          className="h-7 px-3 inline-flex items-center gap-1 text-[12px] bg-[#2b579a] text-white rounded-sm hover:bg-[#1e4580] disabled:opacity-50"
                        >
                          {isCited ? <><Check size={13} /> Cite again</> : <><Quote size={13} /> Cite</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => copy(s)}
                          className="h-7 px-2 inline-flex items-center gap-1 text-[11.5px] border border-[#c8c6c4] rounded-sm hover:bg-[#edebe9]"
                          title="Copy the formatted reference"
                        >
                          {copied === s.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Reference</>}
                        </button>
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="h-7 w-7 grid place-items-center rounded-sm text-[#605e5c] hover:bg-[#edebe9]" title="Open source" aria-label="Open source">
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {doc?.bibliographyAt === null ? (
            <button
              type="button"
              onClick={() => editor?.chain().focus().insertBibliography({ atEnd: true }).run()}
              disabled={!editor || !cited.length}
              className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] bg-[#2b579a] text-white rounded-sm hover:bg-[#1e4580] disabled:opacity-50"
            >
              <BookMarked size={14} /> Insert reference list at the end
            </button>
          ) : (
            <button
              type="button"
              onClick={() => doc?.bibliographyAt != null && goTo(doc.bibliographyAt)}
              className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] border border-[#c8c6c4] rounded-sm hover:bg-[#edebe9]"
            >
              <Check size={14} className="text-[#0b6a0b]" /> Reference list is in the document — go to it
            </button>
          )}

          {!cited.length ? (
            <p className="text-center text-[12px] text-[#605e5c] pt-4">No citations yet. Use <b>Find sources</b> to cite as you write.</p>
          ) : (
            <ol className="space-y-2.5">
              {cited.map(({ source, count, firstPos }) => (
                <li key={source.id} className="text-[11.5px] leading-snug border border-[#edebe9] rounded-sm p-2">
                  <p className="text-[#252423]">
                    {referencePreview(source, style).map((seg, i) => (seg.italic ? <em key={i}>{seg.text}</em> : <span key={i}>{seg.text}</span>))}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 text-[#605e5c]">
                    <span>Cited {count}×</span>
                    <button type="button" onClick={() => goTo(firstPos)} className="inline-flex items-center gap-1 hover:text-[#2b579a]">
                      <MapPin size={12} /> Go to first citation
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
