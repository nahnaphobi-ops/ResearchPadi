import { useEffect, useState } from 'react';
import api from '../services/api';
import { BookMarked, Check, Loader2, LogOut, PenLine, Quote, Search, Sparkles } from 'lucide-react';
import { authService } from '../services/apiService';
import { workspaceService } from '../services/workspaceService';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';
import { CITATION_STYLES } from '../components/workspace/citations/format';
import type { CitationStyleId, Source } from '../components/workspace/citations/types';
import {
  insertAfterSelection, insertCitation, replaceSelection, savedSources, savedStyle, saveStyle,
  selectedText, textBeforeCursor, updateCitations,
} from './wordDoc';

const EDITS: { id: string; label: string }[] = [
  { id: 'rewrite', label: 'Improve' },
  { id: 'grammar', label: 'Fix grammar' },
  { id: 'tone', label: 'Academic tone' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'expand', label: 'Expand' },
];

const authorLine = (s: Source) => {
  const names = s.authors.slice(0, 3).map((a) => a.family || a.given).join(', ');
  return `${names}${s.authors.length > 3 ? ' et al.' : ''}${s.year ? ` (${s.year})` : ''}`;
};

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!sent) {
        await authService.requestOtp(phone.trim());
        setSent(true);
      } else {
        const { data } = await authService.verifyOtp(phone.trim(), code.trim());
        if (data.isNewUser) {
          setError('Finish creating your account on researchpadi.com first, then sign in here.');
          return;
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onSignedIn();
      }
    } catch (err) {
      setError(apiErrorMessage(err, sent ? 'That code did not work.' : 'Could not send a code.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      <h1 className="text-base font-extrabold text-navy">Sign in to ResearchPadi</h1>
      <p className="text-xs text-muted">Use the phone number on your ResearchPadi account. We'll text you a code.</p>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} placeholder="024 000 0000" inputMode="tel" required
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm" aria-label="Phone number" />
      {sent && (
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" required autoFocus
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm" aria-label="Code" />
      )}
      {error && <p className="text-xs text-[#a4262c]">{error}</p>}
      <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy && <Loader2 size={14} className="animate-spin" />} {sent ? 'Sign in' : 'Send code'}
      </button>
    </form>
  );
}

function WriteTab() {
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<{ text: string; replace: boolean } | null>(null);
  const [error, setError] = useState('');

  const edit = async (instruction: string) => {
    setError('');
    setResult(null);
    const text = await selectedText();
    if (!text.trim()) return setError('Select some of your text in the document first.');
    setBusy(instruction);
    try {
      const { data } = await workspaceService.assist({ selectedText: text.slice(0, 6000), instruction });
      setResult({ text: String(data.response ?? '').trim(), replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'No suggestion right now.'));
    } finally {
      setBusy('');
    }
  };

  const continueWriting = async () => {
    setError('');
    setResult(null);
    setBusy('continue');
    try {
      const before = await textBeforeCursor();
      if (before.trim().length < 20) return setError('Write a sentence or two first, then put the cursor where you want to continue.');
      const { data } = await workspaceService.autocomplete({ before });
      if (!data.suggestion) return setError('No suggestion right now.');
      const space = /\s$/.test(before) ? '' : ' ';
      setResult({ text: `${space}${data.suggestion.text}${data.suggestion.tail}`, replace: false });
    } catch (err) {
      setError(apiErrorMessage(err, 'No suggestion right now.'));
    } finally {
      setBusy('');
    }
  };

  const keep = async () => {
    if (!result) return;
    await (result.replace ? replaceSelection(result.text) : insertAfterSelection(result.text));
    setResult(null);
  };

  return (
    <div className="space-y-4 p-4">
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Selected text</h2>
        <div className="grid grid-cols-2 gap-2">
          {EDITS.map((e) => (
            <button key={e.id} type="button" disabled={!!busy} onClick={() => edit(e.id)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-rule px-2 py-2 text-xs font-semibold text-navy hover:border-brand disabled:opacity-60">
              {busy === e.id && <Loader2 size={12} className="animate-spin" />} {e.label}
            </button>
          ))}
        </div>
      </section>
      <button type="button" disabled={!!busy} onClick={continueWriting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy === 'continue' ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />} Continue writing at the cursor
      </button>
      {error && <p className="text-xs text-[#a4262c]">{error}</p>}
      {result && (
        <div className="rounded-xl border border-rule bg-navy-mist p-3">
          <p className="mb-1 text-[11px] font-semibold text-muted">AI suggestion: check it before you keep it.</p>
          <p className="whitespace-pre-wrap text-sm text-navy">{result.text}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={keep} className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">
              <Check size={12} /> {result.replace ? 'Replace selection' : 'Insert'}
            </button>
            <button type="button" onClick={() => setResult(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:bg-white">Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CiteTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Source[]>([]);
  const [style, setStyle] = useState<CitationStyleId>(savedStyle);
  const [cited, setCited] = useState(() => Object.keys(savedSources()).length);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const run = async (key: string, task: () => Promise<string | void>) => {
    setBusy(key);
    setMessage('');
    try {
      const note = await task();
      if (note) setMessage(note);
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setBusy('');
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) return;
    void run('search', async () => {
      const { data } = await workspaceService.findSources({ query: query.trim(), ghanaFirst: true, limit: 8 });
      setResults(data.sources);
      if (!data.sources.length) return 'No sources found. Try other words.';
    });
  };

  const changeStyle = (next: CitationStyleId) => {
    setStyle(next);
    void run('style', async () => {
      await saveStyle(next);
      await updateCitations(next);
    });
  };

  return (
    <div className="space-y-4 p-4">
      <form onSubmit={search} className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics, titles, authors" aria-label="Search sources"
          className="min-w-0 flex-1 rounded-lg border border-rule px-3 py-2 text-sm" />
        <button type="submit" disabled={busy === 'search'} aria-label="Search" className="rounded-lg bg-brand px-3 text-white disabled:opacity-60">
          {busy === 'search' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </button>
      </form>
      <ul className="space-y-2">
        {results.map((s) => (
          <li key={s.id} className="rounded-xl border border-rule p-3">
            <p className="text-sm font-semibold leading-snug text-navy">{s.title}</p>
            <p className="mt-0.5 text-xs text-muted">{authorLine(s)}{s.ghanaian ? ' · Ghanaian' : ''}{s.containerTitle ? ` · ${s.containerTitle}` : ''}</p>
            <button type="button" disabled={!!busy} onClick={() => run(s.id, async () => {
              await insertCitation(s, style);
              setCited(Object.keys(savedSources()).length);
            })} className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand hover:underline disabled:opacity-60">
              {busy === s.id ? <Loader2 size={12} className="animate-spin" /> : <Quote size={12} />} Cite at cursor
            </button>
          </li>
        ))}
      </ul>
      <section className="space-y-2 border-t border-rule pt-4">
        <label className="block text-xs font-bold uppercase tracking-wide text-muted" htmlFor="rp-style">Citation style</label>
        <select id="rp-style" value={style} onChange={(e) => changeStyle(e.target.value as CitationStyleId)} className="w-full rounded-lg border border-rule px-2 py-2 text-sm">
          {CITATION_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button type="button" disabled={!!busy} onClick={() => run('refs', async () => {
          const count = await updateCitations(style, true);
          return count ? `Reference list updated (${count} citation${count === 1 ? '' : 's'}).` : 'Reference list added. Cite a source to fill it.';
        })} className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand disabled:opacity-60">
          {busy === 'refs' ? <Loader2 size={14} className="animate-spin" /> : <BookMarked size={14} />} Insert or update reference list
        </button>
        <p className="text-[11px] text-muted">{cited} source{cited === 1 ? '' : 's'} saved in this document.</p>
      </section>
      {message && <p className="text-xs text-navy">{message}</p>}
    </div>
  );
}

export default function WordPane({ inWord }: { inWord: boolean }) {
  const [signedIn, setSignedIn] = useState(() => !!localStorage.getItem('token'));
  // Sign-ins last 7 days; after that every call fails, so go back to the sign-in form.
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (err) => {
      if (apiErrorStatus(err) === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setSignedIn(false);
      }
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
  }, []);
  const [tab, setTab] = useState<'write' | 'cite'>('write');

  if (!inWord) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6 text-sm text-navy">
        <h1 className="text-lg font-extrabold">ResearchPadi for Word</h1>
        <p>This page runs inside Microsoft Word. In Word, go to Home › Add-ins, search for ResearchPadi and add it; it then opens from the ResearchPadi button on the Home tab.</p>
        <a href="/" className="font-semibold text-brand hover:underline">Go to researchpadi.com</a>
      </div>
    );
  }
  if (!signedIn) return <SignIn onSignedIn={() => setSignedIn(true)} />;

  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSignedIn(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <nav className="flex border-b border-rule">
        {([['write', 'Write', Sparkles], ['cite', 'Cite', Quote]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-semibold ${tab === id ? 'border-brand text-brand' : 'border-transparent text-muted'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>
      <main className="flex-1">{tab === 'write' ? <WriteTab /> : <CiteTab />}</main>
      <footer className="flex items-center justify-between border-t border-rule px-4 py-2 text-[11px] text-muted">
        <a href="https://researchpadi.com/workspace" target="_blank" rel="noreferrer" className="hover:text-brand">Open ResearchPadi</a>
        <button type="button" onClick={signOut} className="flex items-center gap-1 hover:text-brand"><LogOut size={11} /> Sign out</button>
      </footer>
    </div>
  );
}
