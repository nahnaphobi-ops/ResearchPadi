import React from 'react';
import type { Editor } from '@tiptap/react';
import { BookOpen, FileText, GraduationCap, Library, Sparkles, X } from 'lucide-react';
import AIAssistantPanel from '../workspace/AIAssistantPanel';
import CitationPanel from '../workspace/CitationPanel';
import NotebookPanel from './notebook/NotebookPanel';
import FeedbackPanel from './review/FeedbackPanel';
import StudyDraftPanel from './draft/StudyDraftPanel';
import type { WorkspacePanel } from './panels';

interface Props {
  editor: Editor | null;
  sidePanel: WorkspacePanel | null;
  setSidePanel: (val: WorkspacePanel | null) => void;
  sessionId: string;
  aiSelectedText: string;
  fullDocText: string;
  onInsertAIContent: (text: string) => void;
  isPremium: boolean;
  onRequestReview: () => void;
  reviewRefreshKey: number;
  hasStudyDraft: boolean;
}

const tabs = [
  { key: 'draft' as const, label: 'Draft', icon: FileText },
  { key: 'ai' as const, label: 'AI', icon: Sparkles },
  { key: 'citations' as const, label: 'Citations', icon: BookOpen },
  { key: 'sources' as const, label: 'Sources', icon: Library },
  { key: 'feedback' as const, label: 'Feedback', icon: GraduationCap },
];

/**
 * Desktop: a column beside the page while a tool is open (opened from the title bar).
 * Below lg: the same title-bar buttons open it as a slide-over drawer.
 */
export const SidePanel: React.FC<Props> = ({
  editor,
  sidePanel,
  setSidePanel,
  sessionId,
  aiSelectedText,
  fullDocText,
  onInsertAIContent,
  isPremium,
  onRequestReview,
  reviewRefreshKey,
  hasStudyDraft,
}) => (
  <>
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
        {tabs.filter((t) => t.key !== 'draft' || hasStudyDraft).map(({ key, label, icon: Icon }, _i, shown) => {
          // Five tabs don't fit with labels: show the open tab's label only.
          const compact = shown.length > 4 && sidePanel !== key;
          return (
            <button
              key={key}
              onClick={() => setSidePanel(sidePanel === key ? null : key)}
              aria-pressed={sidePanel === key}
              aria-label={label}
              title={label}
              className={`${compact ? 'px-2.5' : 'flex-1 px-1.5'} min-w-0 py-2.5 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 ${
                sidePanel === key
                  ? 'text-brand border-b-2 border-brand bg-brand-soft'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Icon size={14} className="shrink-0" /> {!compact && <span className="truncate">{label}</span>}
            </button>
          );
        })}
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
        {sidePanel === 'draft' && hasStudyDraft && <StudyDraftPanel editor={editor} sessionId={sessionId} />}
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
        {sidePanel === 'sources' && <NotebookPanel editor={editor} sessionId={sessionId} isPremium={isPremium} />}
        {sidePanel === 'feedback' && <FeedbackPanel editor={editor} sessionId={sessionId} onRequestReview={onRequestReview} refreshKey={reviewRefreshKey} />}
      </div>
    </aside>
  </>
);
