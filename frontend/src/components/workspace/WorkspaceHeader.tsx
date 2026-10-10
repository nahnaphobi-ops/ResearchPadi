import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Redo2, Save, Sparkles, Undo2 } from 'lucide-react';
import { useEditorState, type Editor } from '@tiptap/react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

interface Props {
  editor: Editor | null;
  lastSaved: Date | null;
  saving: boolean;
  onSave: () => void;
  sidePanel: 'ai' | 'citations' | null;
  onTogglePanel: (panel: 'ai' | 'citations') => void;
}

/** Word-style title bar: quick access toolbar, document name and save state. */
export const WorkspaceHeader: React.FC<Props> = ({ editor, lastSaved, saving, onSave, sidePanel, onTogglePanel }) => {
  const navigate = useNavigate();
  const { activeSession } = useWorkspaceStore();
  const history = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ canUndo: e?.can().undo() ?? false, canRedo: e?.can().redo() ?? false }),
  });

  const status = saving
    ? 'Saving…'
    : lastSaved
      ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Auto-save on';

  const quick = 'h-8 w-8 grid place-items-center rounded text-white/90 hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className="bg-[#2b579a] text-white h-11 px-1.5 sm:px-2 flex items-center justify-between gap-2 shrink-0 no-print">
      <div className="flex items-center gap-0.5 min-w-0">
        <button onClick={() => navigate('/workspace')} className={quick} aria-label="Back to workspace" title="Back to workspace">
          <ArrowLeft size={17} />
        </button>
        <span className="w-px h-5 bg-white/25 mx-1" />
        <button onClick={onSave} disabled={saving} className={quick} aria-label="Save (Ctrl+S)" title="Save (Ctrl+S)">
          <Save size={16} />
        </button>
        <button
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!history?.canUndo}
          className={quick}
          aria-label="Undo (Ctrl+Z)"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!history?.canRedo}
          className={quick}
          aria-label="Redo (Ctrl+Y)"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div className="min-w-0 flex-1 flex items-center justify-center gap-2 text-[13px]">
        <h1 className="truncate font-semibold">{activeSession?.title || 'Untitled document'}</h1>
        {activeSession?.course && <span className="hidden md:inline text-white/70 truncate">· {activeSession.course}</span>}
        <span className="hidden sm:inline text-white/70 whitespace-nowrap" aria-live="polite">— {status}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onTogglePanel('ai')}
          aria-pressed={sidePanel === 'ai'}
          className={`h-8 px-2.5 rounded text-[12.5px] inline-flex items-center gap-1.5 ${sidePanel === 'ai' ? 'bg-white text-[#2b579a]' : 'text-white hover:bg-white/15'}`}
        >
          <Sparkles size={15} /> <span className="hidden lg:inline">AI Assistant</span>
        </button>
        <button
          onClick={() => onTogglePanel('citations')}
          aria-pressed={sidePanel === 'citations'}
          className={`h-8 px-2.5 rounded text-[12.5px] inline-flex items-center gap-1.5 ${sidePanel === 'citations' ? 'bg-white text-[#2b579a]' : 'text-white hover:bg-white/15'}`}
        >
          <BookOpen size={15} /> <span className="hidden lg:inline">Citations</span>
        </button>
      </div>
    </div>
  );
};
