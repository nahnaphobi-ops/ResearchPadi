import React from 'react';
import AIAssistantPanel from '../workspace/AIAssistantPanel';
import CitationPanel from '../workspace/CitationPanel';

interface Props {
  sidePanel: 'ai' | 'citations' | null;
  setSidePanel: (val: 'ai' | 'citations' | null) => void;
  sessionId: string;
  aiSelectedText: string;
  fullDocText: string;
  onInsertAIContent: (text: string) => void;
}

export const SidePanel: React.FC<Props> = ({
  sidePanel,
  setSidePanel,
  sessionId,
  aiSelectedText,
  fullDocText,
  onInsertAIContent,
}) => (
  <div className="w-80 border-l border-gray-200 bg-white flex flex-col shrink-0">
    <div className="flex border-b border-gray-200">
      <button
        onClick={() => setSidePanel(sidePanel === 'ai' ? null : 'ai')}
        className={`flex-1 py-2.5 text-xs font-medium transition ${
          sidePanel === 'ai'
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        ✨ AI Assistant
      </button>
      <button
        onClick={() => setSidePanel(sidePanel === 'citations' ? null : 'citations')}
        className={`flex-1 py-2.5 text-xs font-medium transition ${
          sidePanel === 'citations'
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        📚 Citations
      </button>
    </div>
    <div className="flex-1 overflow-y-auto">
      {sidePanel === 'ai' && (
        <AIAssistantPanel
          sessionId={sessionId}
          selectedText={aiSelectedText}
          fullDocument={fullDocText}
          onInsert={onInsertAIContent}
        />
      )}
      {sidePanel === 'citations' && <CitationPanel sessionId={sessionId} />}
      {!sidePanel && (
        <div className="p-6 text-center text-gray-400">
          <p className="text-sm">Select a panel to get started</p>
        </div>
      )}
    </div>
  </div>
);
