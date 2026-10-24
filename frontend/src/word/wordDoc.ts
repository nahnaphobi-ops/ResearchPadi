/// <reference types="office-js" />
import { computeCitations, styleInfo, DEFAULT_STYLE, isCitationStyle } from '../components/workspace/citations/format';
import type { CitationStyleId, Segment, Source } from '../components/workspace/citations/types';

/**
 * The open Word document, through Office.js. Each in-text citation is a hidden
 * content control tagged with its source's id, and the reference list is one
 * tagged control at the end, so both can be renumbered and rebuilt as the
 * student adds citations, as Word's own citation tools do. The sources and the
 * chosen style are kept in the document's settings, so they travel with the file.
 */
const CITE_TAG = 'rp-cite:';
const REFERENCES_TAG = 'rp-references';
const SOURCES_KEY = 'researchpadi.sources';
const STYLE_KEY = 'researchpadi.style';

/** The selected text ('' when the cursor is just placed). */
export const selectedText = () => Word.run(async (ctx) => {
  const range = ctx.document.getSelection();
  range.load('text');
  await ctx.sync();
  return range.text;
});

/** Up to `max` characters before the cursor, for continuing the student's writing. */
export const textBeforeCursor = (max = 2000) => Word.run(async (ctx) => {
  const range = ctx.document.body.getRange('Start').expandTo(ctx.document.getSelection().getRange('Start'));
  range.load('text');
  await ctx.sync();
  return range.text.slice(-max);
});

export const replaceSelection = (text: string) => Word.run(async (ctx) => {
  ctx.document.getSelection().insertText(text, 'Replace').select('End');
  await ctx.sync();
});

/** Text after the selection (or at the cursor), leaving the student's words as they are. */
export const insertAfterSelection = (text: string) => Word.run(async (ctx) => {
  ctx.document.getSelection().getRange('End').insertText(text, 'After').select('End');
  await ctx.sync();
});

// ── Sources and style, saved in the document ──

const setting = <T,>(key: string): T | null => (Office.context.document.settings.get(key) as T | null) ?? null;
const save = (key: string, value: unknown) => new Promise<void>((resolve, reject) => {
  Office.context.document.settings.set(key, value);
  Office.context.document.settings.saveAsync((r) => (r.status === Office.AsyncResultStatus.Succeeded ? resolve() : reject(r.error)));
});

export const savedSources = (): Record<string, Source> => setting<Record<string, Source>>(SOURCES_KEY) ?? {};
export const savedStyle = (): CitationStyleId => {
  const style = setting<string>(STYLE_KEY);
  return isCitationStyle(style) ? style : DEFAULT_STYLE;
};
export const saveStyle = (style: CitationStyleId) => save(STYLE_KEY, style);

// ── Citations ──

const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const segmentsHtml = (segments: Segment[]) => segments.map((s) => (s.italic ? `<i>${html(s.text)}</i>` : html(s.text))).join('');

/**
 * Every citation in the document relabelled in reading order, and the
 * reference list rebuilt if it is there (or added at the end when asked).
 * Returns how many citations the document has.
 */
async function refresh(ctx: Word.RequestContext, style: CitationStyleId, addReferences: boolean): Promise<number> {
  const controls = ctx.document.body.contentControls;
  controls.load('items/tag');
  await ctx.sync();
  const sources = savedSources();
  const cites = controls.items.filter((c) => c.tag.startsWith(CITE_TAG) && sources[c.tag.slice(CITE_TAG.length)]);
  const { labels, bibliography } = computeCitations(
    cites.map((c) => ({ sources: [sources[c.tag.slice(CITE_TAG.length)]], page: '', mode: 'parenthetical' as const })),
    style,
  );
  cites.forEach((c, i) => c.insertText(labels[i], 'Replace'));

  const existing = controls.items.find((c) => c.tag === REFERENCES_TAG);
  if (!existing && !addReferences) {
    await ctx.sync();
    return cites.length;
  }
  const info = styleInfo(style);
  const entries = bibliography.map((e) => `<p style="margin-left:0.5in;text-indent:-0.5in;line-height:1.5">${e.number ? `[${e.number}] ` : ''}${segmentsHtml(e.segments)}</p>`).join('');
  const body = `<h1>${html(info.bibliographyTitle)}</h1>${entries || '<p>No citations yet.</p>'}`;
  if (existing) {
    existing.insertHtml(body, 'Replace');
  } else {
    const end = ctx.document.body.getRange('End');
    end.insertBreak('Page', 'After');
    const control = ctx.document.body.getRange('End').insertContentControl();
    control.tag = REFERENCES_TAG;
    control.title = 'References (ResearchPadi)';
    control.insertHtml(body, 'Replace');
  }
  await ctx.sync();
  return cites.length;
}

/** An in-text citation at the cursor, with the source saved for the reference list. */
export async function insertCitation(source: Source, style: CitationStyleId) {
  await save(SOURCES_KEY, { ...savedSources(), [source.id]: source });
  await Word.run(async (ctx) => {
    const at = ctx.document.getSelection().getRange('End');
    const control = at.insertContentControl();
    control.tag = `${CITE_TAG}${source.id}`;
    control.title = source.title.slice(0, 200);
    control.appearance = 'Hidden';
    control.insertText('(…)', 'Replace');
    await ctx.sync();
    await refresh(ctx, style, false);
    control.getRange('End').select();
    await ctx.sync();
  });
}

/** Relabel every citation in `style`; with `addReferences`, also put the reference list at the end. */
export const updateCitations = (style: CitationStyleId, addReferences = false) => Word.run((ctx) => refresh(ctx, style, addReferences));
