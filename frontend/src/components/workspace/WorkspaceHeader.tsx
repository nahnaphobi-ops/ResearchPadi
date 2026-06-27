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
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/workspace')}
          className="text-gray-500 hover:text-gray-700 font-medium text-sm"
        >
          ← Back
        </button>
        <h2 className="font-bold text-sm truncate max-w-xs">
          {activeSession?.title || 'Untitled'}
        </h2>
        {activeSession?.course && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {activeSession.course}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">{wordCount.toLocaleString()} words</span>
        <span className="text-xs text-gray-400">{charCount.toLocaleString()} chars</span>
        {lastSaved && (
          <span className="text-xs text-gray-400">
            Saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
        {saving && <span className="text-xs text-blue-500 animate-pulse">Saving...</span>}
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700 disabled:bg-blue-300 transition"
        >
          Save
        </button>
      </div>
    </div>
  );
};
