import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { AutocompleteSuggestion } from '../../../services/workspaceService';
import type { NotebookCitation } from '../../../services/notebookService';
import { toCitationSource } from '../notebook/citeHtml';

/**
 * Autocomplete as you type: when the student pauses at the end of a paragraph,
 * the next sentence appears in grey after the cursor. Tab (or a tap on it)
 * accepts it, with a real citation when it relies on one of the document's
 * sources; typing on or Esc dismisses it.
 */
export interface AutocompleteOptions {
  /** Pause after the last keystroke before asking (ms). */
  delay: number;
  /** Least time between two requests (ms). */
  minInterval: number;
}

/**
 * Set by the page (editor.storage.autocomplete) and read on every pause, so
 * switching it off or running out of today's suggestions takes effect at once.
 */
export interface AutocompleteStorage {
  enabled: boolean;
  fetchSuggestion: ((context: { before: string; after: string }, signal: AbortSignal) => Promise<AutocompleteSuggestion | null>) | null;
}

declare module '@tiptap/core' {
  interface Storage {
    autocomplete: AutocompleteStorage;
  }
}

interface Ghost { pos: number; suggestion: AutocompleteSuggestion }

export const autocompleteKey = new PluginKey<Ghost | null>('rp-autocomplete');

const BEFORE_CHARS = 2000;
const AFTER_CHARS = 300;
const MIN_CHARS = 20;

/** "(Mensah et al., 2021)" for the grey preview; the citation inserted follows the document's style. */
export function citationPreview(c: NotebookCitation): string {
  const families = (c.authors ?? '').split(';').map((a) => a.split(',')[0].trim()).filter(Boolean);
  const who = families.length === 0
    ? c.title.split(/\s+/).slice(0, 4).join(' ')
    : families.length === 1 ? families[0] : families.length === 2 ? `${families[0]} & ${families[1]}` : `${families[0]} et al.`;
  return `(${who}, ${c.year ?? 'n.d.'})`;
}

export const ghostText = (s: AutocompleteSuggestion) => `${s.text}${s.citation ? ` ${citationPreview(s.citation)}` : ''}${s.tail}`;

/** Where a suggestion may appear: the end of a paragraph (outside tables), with nothing selected. */
function suggestionSpot(state: EditorState): number | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if ($from.parent.type.name !== 'paragraph') return null;
  for (let depth = $from.depth; depth > 0; depth--) if ($from.node(depth).type.name === 'table') return null;
  if ($from.parent.textBetween($from.parentOffset, $from.parent.content.size, ' ', ' ').trim()) return null;
  return $from.pos;
}

/** Inserts the suggestion on show, then its citation and closing punctuation. False if there is none. */
export function acceptSuggestion(editor: Editor): boolean {
  const ghost = autocompleteKey.getState(editor.state);
  if (!ghost) return false;
  const { text, tail, citation } = ghost.suggestion;
  // Text nodes, not HTML: what the model wrote is never parsed as markup.
  const chain = editor.chain().focus().setTextSelection(ghost.pos).insertContent({ type: 'text', text });
  if (citation) chain.insertCitation([toCitationSource(citation)]);
  if (tail) chain.insertContent({ type: 'text', text: tail });
  return chain.run();
}

export function dismissSuggestion(editor: Editor): boolean {
  if (!autocompleteKey.getState(editor.state)) return false;
  editor.view.dispatch(editor.state.tr.setMeta(autocompleteKey, null));
  return true;
}

function ghostElement(suggestion: AutocompleteSuggestion, accept: () => void): HTMLElement {
  const span = document.createElement('span');
  span.className = 'rp-ghost';
  span.contentEditable = 'false';
  span.textContent = ghostText(suggestion);
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;
  const key = document.createElement('kbd');
  key.textContent = touch ? 'Tap' : 'Tab';
  span.appendChild(key);
  span.title = touch ? 'Tap to add this' : 'Tab to add this · Esc to dismiss';
  span.setAttribute('aria-label', `Suggestion: ${ghostText(suggestion)}. Press Tab to add it.`);
  span.addEventListener('mousedown', (e) => {
    e.preventDefault();
    accept();
  });
  return span;
}

export const Autocomplete = Extension.create<AutocompleteOptions>({
  name: 'autocomplete',
  // Before lists and indentation, so Tab takes a suggestion when one is showing.
  priority: 1000,

  addOptions() {
    return { delay: 1200, minInterval: 5000 };
  },

  addStorage(): AutocompleteStorage {
    return { enabled: false, fetchSuggestion: null };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => acceptSuggestion(this.editor),
      Escape: () => dismissSuggestion(this.editor),
    };
  },

  addProseMirrorPlugins() {
    const { options, editor } = this;
    return [
      new Plugin<Ghost | null>({
        key: autocompleteKey,
        state: {
          init: () => null,
          apply(tr, current) {
            const meta = tr.getMeta(autocompleteKey);
            if (meta !== undefined) return meta as Ghost | null;
            // Typing on, clicking elsewhere or editing anything else dismisses it.
            return tr.docChanged || tr.selectionSet ? null : current;
          },
        },
        props: {
          decorations(state) {
            const ghost = autocompleteKey.getState(state);
            if (!ghost) return null;
            return DecorationSet.create(state.doc, [
              Decoration.widget(ghost.pos, () => ghostElement(ghost.suggestion, () => acceptSuggestion(editor)), { side: 1, key: `ghost:${ghost.pos}:${ghost.suggestion.text}` }),
            ]);
          },
        },
        view() {
          let timer: number | undefined;
          let inFlight: AbortController | null = null;
          let lastRequest = 0;
          const cancel = () => {
            window.clearTimeout(timer);
            inFlight?.abort();
            inFlight = null;
          };

          const ask = async (view: EditorView) => {
            const { enabled, fetchSuggestion } = editor.storage.autocomplete ?? {};
            if (!enabled || !fetchSuggestion || !view.hasFocus()) return;
            const pos = suggestionSpot(view.state);
            if (pos === null) return;
            const { doc } = view.state;
            const before = doc.textBetween(Math.max(0, pos - BEFORE_CHARS), pos, '\n', ' ');
            if (before.trim().length < MIN_CHARS) return;
            const after = doc.textBetween(pos, Math.min(doc.content.size, pos + AFTER_CHARS), '\n', ' ');

            const controller = new AbortController();
            inFlight = controller;
            lastRequest = Date.now();
            try {
              const suggestion = await fetchSuggestion({ before, after }, controller.signal);
              // Show it only if the student hasn't moved on.
              if (!suggestion || controller.signal.aborted || view.isDestroyed) return;
              if (!view.state.doc.eq(doc) || suggestionSpot(view.state) !== pos) return;
              view.dispatch(view.state.tr.setMeta(autocompleteKey, { pos, suggestion }));
            } catch {
              // No suggestion this time.
            }
          };

          return {
            update(view, previous) {
              // Only typing asks for a suggestion; moving the cursor doesn't.
              if (view.state.doc.eq(previous.doc) || !editor.storage.autocomplete?.enabled) return;
              cancel();
              const wait = Math.max(options.delay, lastRequest + options.minInterval - Date.now());
              timer = window.setTimeout(() => void ask(view), wait);
            },
            destroy: cancel,
          };
        },
      }),
    ];
  },
});
