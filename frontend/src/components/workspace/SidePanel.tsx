import React from 'react';
import type { Editor } from '@tiptap/react';
import { BookOpen, Sparkles, X } from 'lucide-react';
import AIAssistantPanel from '../workspace/AIAssistantPanel';
import CitationPanel from '../workspace/CitationPanel';

interface Props {
  editor: Editor | null;
  sidePanel: 'ai' | 'citations' | null;
  setSidePanel: (val: 'ai' | 'citations' | null) => void;
  sessionId: string;
  aiSelectedText: string;
  fullDocText: string;
  onInsertAIContent: (text: string) => void;
}

const tabs = [
  { key: 'ai' as const, label: 'AI Assistant', icon: Sparkles },
  { key: 'citations' as const, label: 'Citations', icon: BookOpen },
];

/**
 * Desktop: a column beside the page while a tool is open (opened from the title bar).
 * Below lg: floating buttons open it as a slide-over drawer.
 */
export const SidePanel: React.FC<Props> = ({
  editor,
  sidePanel,
  setSidePanel,
  sessionId,
  aiSelectedText,
  fullDocText,
  onInsertAIContent,
}) => (
  <>
    {!sidePanel && (
      <div className="lg:hidden fixed bottom-4 right-4 z-30 flex flex-col gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSidePanel(key)}
            className="btn-primary px-4 py-2.5 text-sm inline-flex items-center gap-2 shadow-card"
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
    )}

    {sidePanel && (
      <div className="lg:hidden fixed inset-0 z-30 bg-navy/30" onClick={() => setSidePanel(null)} aria-hidden="true" />
    )}

    <aside
      className={`${sidePanel ? 'flex' : 'hidden'} flex-col bg-white border-l border-rule shrink-0 no-print
        fixed inset-y-0 right-0 z-40 w-[min(22rem,92vw)] shadow-card
        lg:static lg:z-auto lg:w-80 lg:shadow-none`}
      aria-label="Writing tools"
    >
      <div className="flex border-b border-rule">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSidePanel(sidePanel === key ? null : key)}
            aria-pressed={sidePanel === key}
            className={`flex-1 py-2.5 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 ${
              sidePanel === key
                ? 'text-brand border-b-2 border-brand bg-brand-soft'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
        <button
          onClick={() => setSidePanel(null)}
          className="px-3 text-muted hover:text-ink"
          aria-label="Close writing tools"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sidePanel === 'ai' && (
          <AIAssistantPanel
            sessionId={sessionId}
            selectedText={aiSelectedText}
            fullDocument={fullDocText}
            onInsert={onInsertAIContent}
            onCite={(source) => editor?.chain().focus().insertCitation([source]).run()}
          />
        )}
        {sidePanel === 'citations' && <CitationPanel editor={editor} selectedText={aiSelectedText} />}
      </div>
    </aside>
  </>
);
