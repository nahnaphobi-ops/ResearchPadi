import { useState, useEffect } from 'react';
import { workspaceService } from '../../services/workspaceService';

interface Props {
  sessionId: string;
}

interface Citation {
  title?: string;
  authors?: string;
  year?: number;
  source?: string;
  institution?: string;
  chunk_text?: string;
  url?: string;
  type?: string;
  formatted?: string;
}

interface StyleOption {
  value: string;
  label: string;
  description?: string;
}

const FALLBACK_STYLES: StyleOption[] = [
  { value: 'apa-ghana', label: 'APA Ghana' },
  { value: 'apa-7', label: 'APA 7th' },
  { value: 'knust-harvard', label: 'KNUST Harvard' },
  { value: 'ug-harvard', label: 'UG Harvard' },
  { value: 'vancouver', label: 'Vancouver' },
  { value: 'chicago-author-date', label: 'Chicago' },
  { value: 'ieee', label: 'IEEE' },
  { value: 'mla-9', label: 'MLA 9th' },
];

export default function CitationPanel({ sessionId: _sessionId }: Props) {
  const [query, setQuery] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [format, setFormat] = useState('apa-ghana');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [styles, setStyles] = useState<StyleOption[]>(FALLBACK_STYLES);
  const [searchMode, setSearchMode] = useState<'external' | 'local'>('local');

  useEffect(() => {
    workspaceService.getCitationStyles()
      .then(res => {
        const fetched = res.data.styles?.map((s: any) => ({
          value: s.id,
          label: s.name,
          description: s.description,
        })) || [];
        if (fetched.length > 0) setStyles(fetched);
      })
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      if (searchMode === 'local') {
        const res = await workspaceService.searchLocalCitations({ query, format });
        setCitations(res.data.citations || []);
      } else {
        const res = await workspaceService.searchCitations({ topic: query, format });
        setCitations(res.data.citations || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFormatChange = (newFormat: string) => {
    setFormat(newFormat);
    if (searched && citations.length > 0) {
      setLoading(true);
      const serviceFn = searchMode === 'local'
        ? workspaceService.searchLocalCitations({ query, format: newFormat })
        : workspaceService.searchCitations({ topic: query, format: newFormat });
      serviceFn
        .then(res => setCitations(res.data.citations || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  };

  const copyCitation = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = () => {
    const text = citations.map(c => c.formatted || '').filter(Boolean).join('\n\n');
    if (text) navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-bold text-sm mb-1">Citation Finder</h3>
        <p className="text-xs text-gray-400">Search academic sources and copy formatted citations</p>
      </div>

      {/* Search Mode Toggle */}
      <div className="px-4 pt-3">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setSearchMode('local')}
            className={`flex-1 py-1.5 text-[10px] font-medium rounded transition ${searchMode === 'local' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            Local Repo
          </button>
          <button
            onClick={() => setSearchMode('external')}
            className={`flex-1 py-1.5 text-[10px] font-medium rounded transition ${searchMode === 'external' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            External DB
          </button>
        </div>
      </div>

      {/* Search + Format */}
      <div className="p-4 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={searchMode === 'local' ? 'e.g. mobile learning Ghana' : 'e.g. social media impact education'}
            className="flex-1 p-2 border rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 transition"
          >
            {loading ? '...' : 'Search'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Format:</label>
          <select
            value={format}
            onChange={(e) => handleFormatChange(e.target.value)}
            className="flex-1 p-1.5 border rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white"
          >
            {styles.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-4 pb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 animate-pulse">
            {searchMode === 'local' ? 'Searching local repository...' : 'Searching academic databases...'}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
            {error}
          </div>
        </div>
      )}

      {/* Results */}
      {citations.length > 0 && (
        <div className="px-4 pb-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">
              {citations.length} source{citations.length !== 1 ? 's' : ''} found
            </p>
            <button
              onClick={copyAll}
              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
            >
              Copy All
            </button>
          </div>
          <div className="space-y-3">
            {citations.map((c, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-800 mb-1 line-clamp-2">
                  {c.title || 'Untitled'}
                </p>
                {c.authors && (
                  <p className="text-xs text-gray-500 mb-1">{c.authors}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 flex-wrap">
                  {c.year && <span>{c.year}</span>}
                  {c.source && (
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {c.source}
                    </span>
                  )}
                  {c.institution && (
                    <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      {c.institution}
                    </span>
                  )}
                </div>
                {c.chunk_text && (
                  <p className="text-xs text-gray-500 line-clamp-2 italic mb-2">
                    &ldquo;{c.chunk_text}...&rdquo;
                  </p>
                )}
                {c.formatted && (
                  <div className="bg-white border border-gray-200 rounded p-2 mb-2 text-xs text-gray-700 leading-relaxed">
                    {c.formatted}
                  </div>
                )}
                <button
                  onClick={() => copyCitation(c.formatted || '', i)}
                  className="text-xs font-medium transition"
                >
                  {copiedIndex === i ? (
                    <span className="text-green-600">Copied!</span>
                  ) : (
                    <span className="text-blue-600 hover:text-blue-800">Copy formatted citation</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && citations.length === 0 && !error && (
        <div className="px-4 pb-4 text-center text-gray-400 text-sm">
          No sources found. Try different keywords.
        </div>
      )}
    </div>
  );
}
