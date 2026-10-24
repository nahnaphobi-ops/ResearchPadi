import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { workspaceService, type ClaimCheckResult, type ClaimVerdict } from '../../../services/workspaceService';
import { apiErrorMessage } from '../../../utils/apiError';
import { findClaims, showSentence, type FoundClaims, type FoundSentence } from './findClaims';

const MAX_CLAIMS = 15;

const VERDICT: Record<ClaimVerdict, { label: string; className: string }> = {
  supported: { label: 'Supported', className: 'bg-green-100 text-green-800' },
  weak: { label: 'Weakly supported', className: 'bg-amber-100 text-amber-800' },
  overstated: { label: 'Overstated', className: 'bg-orange-100 text-orange-800' },
  contradicted: { label: 'Contradicted', className: 'bg-red-100 text-red-800' },
  misrepresented: { label: 'Misrepresented', className: 'bg-red-100 text-red-800' },
  'not-found': { label: 'Not found in the passages checked', className: 'bg-gray-100 text-gray-700' },
};

interface Props {
  editor: Editor | null;
  sessionId: string;
}

/**
 * Checks each sentence that cites one of the document's uploaded sources
 * against that source, like a supervisor reading the source beside the paper.
 * Also lists figures with no citation, found without AI.
 */
export default function SourceClaimCheck({ editor, sessionId }: Props) {
  const [found, setFound] = useState<FoundClaims | null>(null);
  const [results, setResults] = useState<Map<string, ClaimCheckResult>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const claims = findClaims(editor.state.doc, from !== to ? { from, to } : undefined);
    setFound(claims);
    setResults(new Map());
    setError('');
    if (!claims.checkable.length) return;
    setBusy(true);
    try {
      const { data } = await workspaceService.claimCheck(
        sessionId,
        claims.checkable.slice(0, MAX_CLAIMS).map(({ id, text, sourceIds }) => ({ id, text, sourceIds })),
      );
      setResults(new Map(data.results.map((r) => [r.id, r])));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not check your claims right now.'));
    } finally {
      setBusy(false);
    }
  };

  const show = (s: FoundSentence) => { if (editor) showSentence(editor, s); };

  return (
    <div className="space-y-2">
      <button
        onClick={() => void run()}
        disabled={busy || !editor}
        className="w-full p-3 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition"
      >
        {busy ? 'Reading your sources…' : 'Check claims against my sources'}
      </button>
      <p className="text-[10.5px] text-gray-500 leading-relaxed">
        Checks each sentence that cites one of your uploaded sources against that source (select text to check part of the document).
        It reads the passages nearest each sentence, so "not found" means not in those passages: look in the source yourself.
      </p>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">{error}</div>}

      {found && !found.checkable.length && !busy && (
        <p className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-600">
          No sentences here cite your uploaded sources yet. Add sources in the Sources panel and cite them, then check again.
        </p>
      )}
      {found && found.checkable.length > MAX_CLAIMS && (
        <p className="text-[10.5px] text-gray-500">Checked the first {MAX_CLAIMS} of {found.checkable.length} cited sentences. Select a later part of the document to check the rest.</p>
      )}

      {found?.checkable.slice(0, MAX_CLAIMS).map((s) => {
        const r = results.get(s.id);
        if (!r) return null;
        const v = VERDICT[r.verdict];
        return (
          <div key={s.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${v.className}`}>{v.label}</span>
              <button onClick={() => show(s)} className="text-[10.5px] font-medium text-purple-700 hover:underline">Show in document</button>
            </div>
            <p className="text-gray-800 line-clamp-3">{s.text}</p>
            {r.reason && <p className="text-gray-600">{r.reason}</p>}
            {r.quote && <p className="text-gray-500 italic border-l-2 border-purple-200 pl-2">&ldquo;{r.quote}&rdquo;</p>}
            {r.sources[0] && (
              <p className="text-[10px] text-gray-400 truncate">
                {r.sources.map((src) => [src.title, [src.authors?.split(';')[0]?.split(',')[0], src.year].filter(Boolean).join(', ')].filter(Boolean).join(' · ')).join('; ')}
              </p>
            )}
          </div>
        );
      })}

      {found && found.needsCitation.length > 0 && (
        <div className="pt-1">
          <p className="text-[11px] font-semibold text-gray-600 mb-1">Figures with no citation ({found.needsCitation.length})</p>
          {found.needsCitation.map((s) => (
            <button key={s.id} onClick={() => show(s)} className="block w-full text-left bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-gray-700 mb-1 hover:border-amber-400">
              <span className="line-clamp-2">{s.text}</span>
            </button>
          ))}
        </div>
      )}
      {found && found.notUploaded.length > 0 && (
        <p className="text-[10.5px] text-gray-500 leading-relaxed">
          {found.notUploaded.length} sentence{found.notUploaded.length === 1 ? ' cites a source' : 's cite sources'} you haven't uploaded, so {found.notUploaded.length === 1 ? 'it' : 'they'} can't be checked.
          Add the source in the Sources panel to include {found.notUploaded.length === 1 ? 'it' : 'them'}.
        </p>
      )}
    </div>
  );
}
