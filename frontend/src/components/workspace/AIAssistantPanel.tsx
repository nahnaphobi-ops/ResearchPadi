import { useState } from 'react';
import { workspaceService } from '../../services/workspaceService';

interface Props {
  sessionId: string;
  selectedText: string;
  fullDocument: string;
  onInsert: (text: string) => void;
}

type Tab = 'write' | 'grammar' | 'claims' | 'plagiarism' | 'ai-detect' | 'citations';

const WRITE_ACTIONS = [
  { key: 'continue', label: 'Continue Writing', icon: '➡️', desc: 'Continue from where you left off' },
  { key: 'expand', label: 'Expand', icon: '📝', desc: 'Add more detail and evidence' },
  { key: 'shorten', label: 'Shorten', icon: '✂️', desc: 'Make it more concise' },
  { key: 'rewrite', label: 'Rewrite', icon: '🔄', desc: 'Improve clarity and flow' },
  { key: 'rag-enhance', label: 'RAG Enhance', icon: '📚', desc: 'Enhance with local sources' },
];

const STANDALONE_ACTIONS = [
  { key: 'outline', label: 'Generate Outline', icon: '📋', desc: 'Create paper outline' },
  { key: 'abstract', label: 'Generate Abstract', icon: '📄', desc: 'Write structured abstract' },
  { key: 'suggest-citations', label: 'Suggest Citations', icon: '🔍', desc: 'Find citations for text' },
];

function IssueItem({ issue }: { issue: any }) {
  const severityColors: Record<string, string> = {
    error: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    suggestion: 'bg-blue-50 border-blue-200 text-blue-700',
  };
  const severityBadge: Record<string, string> = {
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    suggestion: 'bg-blue-100 text-blue-800',
  };
  return (
    <div className={`border rounded-lg p-2.5 text-xs ${severityColors[issue.severity] || 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBadge[issue.severity] || ''}`}>
          {issue.severity}
        </span>
        <span className="text-[10px] text-gray-400">{issue.rule}</span>
      </div>
      <p className="font-medium mb-1">{issue.message}</p>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="line-through opacity-60">{issue.original}</span>
        <span>→</span>
        <span className="font-medium">{issue.suggestion}</span>
      </div>
    </div>
  );
}

function ClaimItem({ analysis }: { analysis: any }) {
  const confColors: Record<string, string> = {
    high: 'text-green-600 bg-green-50 border-green-200',
    medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    low: 'text-orange-600 bg-orange-50 border-orange-200',
    unsupported: 'text-red-600 bg-red-50 border-red-200',
  };
  return (
    <div className={`border rounded-lg p-2.5 text-xs ${confColors[analysis.confidence] || 'bg-gray-50'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium">{analysis.confidence.toUpperCase()}</span>
        <span className="text-[10px] opacity-60">{analysis.claim.substring(0, 80)}...</span>
      </div>
      <p className="text-gray-600 mb-1">{analysis.explanation}</p>
      {analysis.sources?.length > 0 && (
        <div className="mt-1">
          <p className="text-[10px] text-gray-400 mb-0.5">Sources:</p>
          {analysis.sources.slice(0, 2).map((s: any, i: number) => (
            <p key={i} className="text-[10px] text-gray-500 truncate">- {s.title} ({s.year})</p>
          ))}
        </div>
      )}
      {analysis.suggestions?.length > 0 && (
        <div className="mt-1">
          {analysis.suggestions.map((s: string, i: number) => (
            <p key={i} className="text-[10px] text-gray-500">• {s}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function PlagiarismItem({ match }: { match: any }) {
  return (
    <div className="border border-orange-200 bg-orange-50 rounded-lg p-2.5 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-medium">
          {Math.round(match.similarity * 100)}% match
        </span>
        <span className="text-[10px] text-gray-400">{match.source}</span>
      </div>
      <p className="text-gray-600 line-clamp-2 mb-1 italic">"{match.originalText}"</p>
      <p className="text-[10px] text-gray-500 line-clamp-2">Matched: {match.matchedText?.substring(0, 150)}...</p>
    </div>
  );
}

function AIDetectResult({ result }: { result: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${result.aiScore > 50 ? 'bg-red-500' : result.aiScore > 30 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${result.aiScore}%` }}
          />
        </div>
        <span className="text-xs font-bold">{result.aiScore}% AI</span>
      </div>
      <div className="flex gap-4 text-xs">
        <span className="text-red-600">AI: {result.aiScore}%</span>
        <span className="text-green-600">Human: {result.humanScore}%</span>
      </div>
      <p className="text-xs text-gray-600">{result.recommendation}</p>
      {result.indicators?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-gray-500">Indicators:</p>
          {result.indicators.map((ind: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${ind.severity === 'high' ? 'bg-red-500' : ind.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
              <span className="text-gray-600">{ind.type}: {ind.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AIAssistantPanel({ sessionId, selectedText, fullDocument, onInsert }: Props) {
  const [tab, setTab] = useState<Tab>('write');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [history, setHistory] = useState<Array<{ action: string; result: string }>>([]);

  // Advanced results
  const [grammarIssues, setGrammarIssues] = useState<any[]>([]);
  const [grammarSummary, setGrammarSummary] = useState<any>(null);
  const [claimAnalyses, setClaimAnalyses] = useState<any[]>([]);
  const [plagiarismReport, setPlagiarismReport] = useState<any>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [suggestedCitations, setSuggestedCitations] = useState<any[]>([]);

  const contentToAnalyze = selectedText || fullDocument || '';

  const handleWriteAction = async (instruction: string) => {
    setLoading(true);
    setError('');
    setResponse('');
    try {
      const res = await workspaceService.assist({
        selectedText: selectedText || undefined,
        instruction,
        sessionId,
      });
      const text = res.data.response;
      setResponse(text);
      setHistory((prev) => [{ action: instruction, result: text }, ...prev].slice(0, 10));
    } catch (err: any) {
      setError(err.response?.data?.error || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvancedAction = async (action: string) => {
    if (!contentToAnalyze) {
      setError('Select text or write content first');
      return;
    }
    setLoading(true);
    setError('');
    clearResults();
    try {
      const res = await workspaceService.assistAdvanced({
        action,
        text: selectedText || undefined,
        fullDocument: !selectedText ? fullDocument : undefined,
        sessionId,
      });
      switch (action) {
        case 'grammar':
          setGrammarIssues(res.data.issues || []);
          setGrammarSummary(res.data.summary || null);
          break;
        case 'claims':
          setClaimAnalyses(res.data.analyses || []);
          break;
        case 'plagiarism':
          setPlagiarismReport(res.data.report || null);
          break;
        case 'ai-detect':
          setAiResult(res.data.result || null);
          break;
        case 'suggest-citations':
          setSuggestedCitations(res.data.suggestions || []);
          break;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || `${action} failed`);
    } finally {
      setLoading(false);
    }
  };

  const handleCustom = async () => {
    if (!customPrompt.trim()) return;
    await handleWriteAction(customPrompt.trim());
    setCustomPrompt('');
  };

  const clearResults = () => {
    setResponse('');
    setGrammarIssues([]);
    setGrammarSummary(null);
    setClaimAnalyses([]);
    setPlagiarismReport(null);
    setAiResult(null);
    setSuggestedCitations([]);
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'write', label: 'Write', icon: '✍️' },
    { key: 'grammar', label: 'Grammar', icon: '✅' },
    { key: 'claims', label: 'Claims', icon: '📊' },
    { key: 'plagiarism', label: 'Plagiarism', icon: '🔍' },
    { key: 'ai-detect', label: 'AI Detect', icon: '🤖' },
    { key: 'citations', label: 'Citations', icon: '📚' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header with selected text */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-bold text-sm mb-1">AI Writing Assistant</h3>
        {selectedText ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-gray-600 max-h-20 overflow-y-auto">
            <span className="font-medium text-yellow-700">Selected: </span>
            &ldquo;{selectedText.substring(0, 150)}{selectedText.length > 150 ? '...' : ''}&rdquo;
          </div>
        ) : fullDocument ? (
          <p className="text-xs text-green-600">Full document loaded ({fullDocument.split(/\s+/).length} words)</p>
        ) : (
          <p className="text-xs text-gray-400">Select text or write content to get started</p>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); clearResults(); setError(''); }}
            className={`px-2.5 py-2 text-[10px] font-medium whitespace-nowrap transition ${tab === t.key ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* === WRITE TAB === */}
        {tab === 'write' && (
          <>
            <p className="text-xs font-medium text-gray-500">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {WRITE_ACTIONS.map((action) => (
                <button
                  key={action.key}
                  onClick={() => handleWriteAction(action.key)}
                  disabled={loading || (!selectedText && !fullDocument && action.key !== 'outline' && action.key !== 'abstract')}
                  className="p-2 text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="font-medium">{action.icon} {action.label}</span>
                  <p className="text-gray-400 mt-0.5">{action.desc}</p>
                </button>
              ))}
            </div>
            <p className="text-xs font-medium text-gray-500 mt-3">Generate</p>
            <div className="grid grid-cols-2 gap-2">
              {STANDALONE_ACTIONS.map((action) => (
                <button
                  key={action.key}
                  onClick={() => action.key === 'suggest-citations' ? handleAdvancedAction('suggest-citations') : handleWriteAction(action.key)}
                  disabled={loading || (action.key === 'suggest-citations' && !contentToAnalyze)}
                  className="p-2 text-left bg-green-50 hover:bg-green-100 border border-green-200 hover:border-green-400 rounded-lg text-xs transition disabled:opacity-40"
                >
                  <span className="font-medium">{action.icon} {action.label}</span>
                  <p className="text-gray-400 mt-0.5">{action.desc}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* === GRAMMAR TAB === */}
        {tab === 'grammar' && (
          <>
            <button
              onClick={() => handleAdvancedAction('grammar')}
              disabled={loading || !contentToAnalyze}
              className="w-full p-3 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition"
            >
              {loading ? 'Checking...' : 'Check Grammar & Style'}
            </button>
            {grammarSummary && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Score: {grammarSummary.score}/100</span>
                  <div className="flex gap-2">
                    <span className="text-red-600">{grammarSummary.errors} errors</span>
                    <span className="text-yellow-600">{grammarSummary.warnings} warnings</span>
                    <span className="text-blue-600">{grammarSummary.suggestions} tips</span>
                  </div>
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${grammarSummary.score > 80 ? 'bg-green-500' : grammarSummary.score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${grammarSummary.score}%` }}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              {grammarIssues.map((issue, i) => (
                <IssueItem key={i} issue={issue} />
              ))}
            </div>
          </>
        )}

        {/* === CLAIMS TAB === */}
        {tab === 'claims' && (
          <>
            <button
              onClick={() => handleAdvancedAction('claims')}
              disabled={loading || !contentToAnalyze}
              className="w-full p-3 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition"
            >
              {loading ? 'Validating...' : 'Validate Claims Against Knowledge Base'}
            </button>
            {selectedText && (
              <button
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  try {
                    const res = await workspaceService.assistAdvanced({
                      action: 'validate-claim',
                      text: selectedText,
                    });
                    setClaimAnalyses([res.data.analysis]);
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Validation failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !selectedText}
                className="w-full p-2 bg-purple-100 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-200 disabled:opacity-40 transition"
              >
                Validate Selected Claim Only
              </button>
            )}
            <div className="space-y-2">
              {claimAnalyses.map((analysis, i) => (
                <ClaimItem key={i} analysis={analysis} />
              ))}
            </div>
          </>
        )}

        {/* === PLAGIARISM TAB === */}
        {tab === 'plagiarism' && (
          <>
            <button
              onClick={() => handleAdvancedAction('plagiarism')}
              disabled={loading || !contentToAnalyze}
              className="w-full p-3 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 disabled:bg-orange-300 transition"
            >
              {loading ? 'Checking...' : 'Check Plagiarism'}
            </button>
            {plagiarismReport && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Similarity: {Math.round(plagiarismReport.overallSimilarity * 100)}%</span>
                  <span className="text-gray-500">{plagiarismReport.matchCount} matches</span>
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${plagiarismReport.overallSimilarity > 0.3 ? 'bg-red-500' : plagiarismReport.overallSimilarity > 0.1 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, plagiarismReport.overallSimilarity * 100)}%` }}
                  />
                </div>
                <div className="flex gap-4 text-[10px] text-gray-500">
                  <span>{plagiarismReport.totalWords} words</span>
                  <span>{plagiarismReport.uniqueWords} unique</span>
                </div>
                {plagiarismReport.sources?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 mb-1">Top sources:</p>
                    {plagiarismReport.sources.slice(0, 3).map((s: any, i: number) => (
                      <p key={i} className="text-[10px] text-gray-500 truncate">- {s.name} ({s.matchCount} matches)</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              {plagiarismReport?.matches?.slice(0, 10).map((match: any, i: number) => (
                <PlagiarismItem key={i} match={match} />
              ))}
            </div>
          </>
        )}

        {/* === AI DETECT TAB === */}
        {tab === 'ai-detect' && (
          <>
            <button
              onClick={() => handleAdvancedAction('ai-detect')}
              disabled={loading || !contentToAnalyze}
              className="w-full p-3 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:bg-teal-300 transition"
            >
              {loading ? 'Analyzing...' : 'Detect AI Content'}
            </button>
            {aiResult && <AIDetectResult result={aiResult} />}
          </>
        )}

        {/* === CITATIONS TAB === */}
        {tab === 'citations' && (
          <>
            <button
              onClick={() => handleAdvancedAction('suggest-citations')}
              disabled={loading || !contentToAnalyze}
              className="w-full p-3 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition"
            >
              {loading ? 'Searching...' : 'Find Citations for Content'}
            </button>
            {suggestedCitations.length > 0 && (
              <div className="space-y-2">
                {suggestedCitations.map((c, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs">
                    <p className="font-medium text-gray-800 mb-1 line-clamp-2">{c.title || 'Untitled'}</p>
                    {c.authors && <p className="text-gray-500 mb-1">{c.authors}</p>}
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-2">
                      {c.year && <span>{c.year}</span>}
                      {c.institution && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{c.institution}</span>}
                    </div>
                    {c.relevantText && <p className="text-gray-500 line-clamp-2 italic mb-2">&ldquo;{c.relevantText}...&rdquo;</p>}
                    <button
                      onClick={() => {
                        const citationText = `${c.authors || 'Unknown'} (${c.year || 'n.d.'}). ${c.title}.`;
                        onInsert(citationText);
                      }}
                      className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Insert Citation
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Custom Prompt (Write tab only) */}
        {tab === 'write' && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Custom Request</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustom()}
                placeholder="e.g. Rewrite this in passive voice"
                className="flex-1 p-2 border rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={handleCustom}
                disabled={loading || !customPrompt.trim()}
                className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 transition"
              >
                Ask
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-4 pb-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 animate-pulse">
            AI is thinking...
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pb-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
            {error}
            {error.includes('API key') && (
              <p className="text-[10px] text-red-500 mt-1">Add ANTHROPIC_API_KEY or OPENAI_API_KEY to backend .env</p>
            )}
          </div>
        </div>
      )}

      {/* Response (Write tab) */}
      {tab === 'write' && response && (
        <div className="px-4 pb-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-green-700">AI Response</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onInsert(response)}
                  className="text-[10px] px-2 py-1 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition"
                >
                  Insert
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(response)}
                  className="text-[10px] px-2 py-1 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 transition"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {response}
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && tab === 'write' && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Recent</p>
          <div className="space-y-1">
            {history.slice(1, 4).map((item, i) => (
              <div key={i} className="bg-gray-50 rounded p-2 text-[10px] text-gray-500 truncate">
                {item.action}: {item.result.substring(0, 60)}...
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
