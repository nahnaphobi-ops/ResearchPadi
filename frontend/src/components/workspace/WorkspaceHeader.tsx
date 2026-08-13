import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

interface Props {
  wordCount: number;
  charCount: number;
  lastSaved: Date | null;
  saving: boolean;
  onSave: () => void;
}

export const WorkspaceHeader: React.FC<Props> = ({ wordCount, charCount, lastSaved, saving, onSave }) => {
  const navigate = useNavigate();
  const { activeSession } = useWorkspaceStore();

  return (
    <div className="bg-navy text-white border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/workspace')}
          className="text-white/65 hover:text-white font-medium text-sm"
        >
          ← Back
        </button>
          <h2 className="font-bold text-sm truncate max-w-xs text-white">
          {activeSession?.title || 'Untitled'}
        </h2>
        {activeSession?.course && (
          <span className="text-xs bg-white/10 text-white/85 px-2 py-0.5 rounded-lg">
            {activeSession.course}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
         <span className="text-xs text-white/55 hidden sm:inline">{wordCount.toLocaleString()} words</span>
         <span className="text-xs text-white/55 hidden sm:inline">{charCount.toLocaleString()} chars</span>
        {lastSaved && (
            <span className="text-xs text-white/55 hidden md:inline">
            Saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
        {saving && <span className="text-xs text-white/80 animate-pulse">Saving...</span>}
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-brand text-white text-xs rounded-[10px] font-bold hover:bg-brand-hover disabled:opacity-50 transition"
        >
          Save
        </button>
      </div>
    </div>
  );
};
