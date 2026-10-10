import { Extension, Node, mergeAttributes, type JSONContent } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { DOMOutputSpec } from '@tiptap/pm/model';
import { computeCitations, DEFAULT_STYLE, isCitationStyle, styleInfo } from './format';
import type { BibliographyEntry, CitationMode, CitationStyleId, Source } from './types';
import CitationView from './CitationView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citations: {
      /** Cite sources at the cursor (merging into a citation right before the cursor). */
      insertCitation: (sources: Source[], opts?: { mode?: CitationMode }) => ReturnType;
      setCitationStyle: (style: CitationStyleId) => ReturnType;
      /** Insert the auto-updating reference list (at the cursor, or the end of the document). */
      insertBibliography: (opts?: { atEnd?: boolean }) => ReturnType;
    };
  }
}

export const citationPluginKey = new PluginKey<{ style: CitationStyleId }>('rp-citations');

function parseSources(raw: string | null): Source[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === 'string' && typeof s.title === 'string') : [];
  } catch {
    return [];
  }
}

function parseEntries(raw: unknown): BibliographyEntry[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Inline citation, e.g. "(Mensah & Owusu, 2021, p. 23)". Self-contained: it carries its sources. */
export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      sources: {
        default: [] as Source[],
        parseHTML: (el: HTMLElement) => parseSources(el.getAttribute('data-sources')),
        renderHTML: (attrs: { sources: Source[] }) => ({ 'data-sources': JSON.stringify(attrs.sources ?? []) }),
      },
      page: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-page') ?? '',
        renderHTML: (attrs: { page: string }) => (attrs.page ? { 'data-page': attrs.page } : {}),
      },
      mode: {
        default: 'parenthetical' as CitationMode,
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-mode') === 'narrative' ? 'narrative' : 'parenthetical'),
        renderHTML: (attrs: { mode: CitationMode }) => ({ 'data-mode': attrs.mode }),
      },
      label: {
        default: '',
        parseHTML: (el: HTMLElement) => el.textContent ?? '',
        renderHTML: () => ({}),
      },
      style: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-style') ?? '',
        renderHTML: (attrs: { style: string }) => (attrs.style ? { 'data-style': attrs.style } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-citation]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-citation': '', class: 'citation' }), node.attrs.label || '(citation)'];
  },

  renderText({ node }) {
    return node.attrs.label || '';
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationView, { as: 'span', className: 'citation-wrapper' });
  },
});

/** The reference list. Its entries are computed from the document's citations. */
export const Bibliography = Node.create({
  name: 'bibliography',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      entries: { default: '[]', parseHTML: () => '[]', renderHTML: () => ({}) },
      style: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-style') ?? '',
        renderHTML: (attrs: { style: string }) => (attrs.style ? { 'data-style': attrs.style } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-bibliography]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const style = isCitationStyle(node.attrs.style) ? node.attrs.style : DEFAULT_STYLE;
    const info = styleInfo(style);
    const entries = parseEntries(node.attrs.entries);
    const children: DOMOutputSpec[] = entries.length
      ? entries.map((e) => [
          'p',
          { class: info.numeric ? 'bib-entry bib-numbered' : 'bib-entry' },
          ...(e.number ? [['span', { class: 'bib-number' }, `[${e.number}]`] as DOMOutputSpec] : []),
          ...e.segments.map((seg): DOMOutputSpec | string => (seg.italic ? ['em', seg.text] : seg.text)),
        ] as DOMOutputSpec)
      : [['p', { class: 'bib-empty' }, 'Cite sources in your text and they will be listed here automatically.']];
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-bibliography': '', class: 'bibliography' }),
      ['h1', { class: 'bib-title' }, info.bibliographyTitle],
      ...children,
    ];
  },
});

function detectStyle(doc: PMNode): CitationStyleId {
  let found: CitationStyleId | null = null;
  doc.descendants((node) => {
    if (found) return false;
    if ((node.type.name === 'citation' || node.type.name === 'bibliography') && isCitationStyle(node.attrs.style)) {
      found = node.attrs.style as CitationStyleId;
    }
    return true;
  });
  return found ?? DEFAULT_STYLE;
}

export function getCitationStyle(state: EditorState): CitationStyleId {
  return citationPluginKey.getState(state)?.style ?? DEFAULT_STYLE;
}

/** Sources cited in the document, with how many times each is cited and where it first appears. */
export function getCitedSources(state: EditorState): { source: Source; count: number; firstPos: number }[] {
  const map = new Map<string, { source: Source; count: number; firstPos: number }>();
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'citation') return true;
    for (const s of (node.attrs.sources ?? []) as Source[]) {
      const cur = map.get(s.id);
      if (cur) cur.count++;
      else map.set(s.id, { source: s, count: 1, firstPos: pos });
    }
    return false;
  });
  return [...map.values()];
}

export function hasBibliography(state: EditorState): number | null {
  let at: number | null = null;
  state.doc.descendants((node, pos) => {
    if (at !== null) return false;
    if (node.type.name === 'bibliography') at = pos;
    return true;
  });
  return at;
}

/** Keeps every citation label and the reference list in sync with the document and chosen style. */
export const CitationManager = Extension.create({
  name: 'citationManager',

  addCommands() {
    return {
      setCitationStyle: (style) => ({ tr, dispatch }) => {
        if (dispatch) tr.setMeta(citationPluginKey, { style });
        return true;
      },

      insertCitation: (sources, opts = {}) => ({ state, tr, dispatch }) => {
        if (!sources.length) return false;
        const { $to } = state.selection;
        const before = $to.nodeBefore;
        if (dispatch) {
          if (before?.type.name === 'citation') {
            // Typing a second source right after a citation makes one combined citation.
            const pos = $to.pos - before.nodeSize;
            const merged = [...(before.attrs.sources as Source[])];
            for (const s of sources) if (!merged.some((m) => m.id === s.id)) merged.push(s);
            tr.setNodeMarkup(pos, undefined, { ...before.attrs, sources: merged });
          } else {
            const node = state.schema.nodes.citation.create({ sources, mode: opts.mode ?? 'parenthetical' });
            let at = $to.pos;
            const charBefore = $to.parent.textBetween(Math.max(0, $to.parentOffset - 1), $to.parentOffset, undefined, '￼');
            if (charBefore && !/\s|\(|\[/.test(charBefore)) {
              tr.insertText(' ', at);
              at += 1;
            }
            tr.insert(at, node);
          }
        }
        return true;
      },

      insertBibliography: (opts = {}) => ({ state, chain }) => {
        if (hasBibliography(state) !== null) return false;
        const content: JSONContent[] = [{ type: 'bibliography' }, { type: 'paragraph' }];
        if (opts.atEnd) return chain().insertContentAt(state.doc.content.size, content).run();
        return chain().insertContent(content).run();
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<{ style: CitationStyleId }>({
        key: citationPluginKey,
        state: {
          init: (_, state) => ({ style: detectStyle(state.doc) }),
          apply(tr, value) {
            const meta = tr.getMeta(citationPluginKey) as { style?: CitationStyleId } | undefined;
            return meta?.style ? { style: meta.style } : value;
          },
        },
        appendTransaction(transactions, _oldState, newState) {
          const relevant = transactions.some((t) => t.docChanged || t.getMeta(citationPluginKey));
          if (!relevant) return null;

          const style = getCitationStyle(newState);
          const cites: { pos: number; node: PMNode }[] = [];
          const bibs: { pos: number; node: PMNode }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'citation') cites.push({ pos, node });
            else if (node.type.name === 'bibliography') bibs.push({ pos, node });
            return true;
          });
          if (!cites.length && !bibs.length) return null;

          const out = computeCitations(
            cites.map(({ node }) => ({ sources: node.attrs.sources as Source[], page: String(node.attrs.page ?? ''), mode: node.attrs.mode as CitationMode })),
            style,
          );
          const entries = JSON.stringify(out.bibliography);

          const tr = newState.tr;
          let changed = false;
          cites.forEach(({ pos, node }, i) => {
            if (node.attrs.label !== out.labels[i] || node.attrs.style !== style) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, label: out.labels[i], style });
              changed = true;
            }
          });
          for (const { pos, node } of bibs) {
            if (node.attrs.entries !== entries || node.attrs.style !== style) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, entries, style });
              changed = true;
            }
          }
          return changed ? tr : null;
        },
      }),
    ];
  },
});
