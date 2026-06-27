import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import adminApi from '../../services/adminApi';

interface ClaimAnalysis {
  claim: string;
  confidence: 'high' | 'medium' | 'low' | 'unsupported';
  sources: Array<{ title: string; authors: string; institution: string; year: number; relevantText: string }>;
  explanation: string;
  suggestions: string[];
}

interface GrammarIssue {
  type: string;
  severity: string;
  message: string;
  original: string;
  suggestion: string;
  position: { start: number; end: number };
  rule: string;
}



interface DisclosureTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
}

interface CitationStyle {
  id: string;
  name: string;
  description: string;
}

type Tab = 'grammar' | 'claims' | 'plagiarism' | 'ai-detect' | 'citations' | 'pdf-chat' | 'blueprints';

export default function WritingAssist() {
  const [text, setText] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('grammar');
  const [loading, setLoading] = useState(false);

  const [grammarIssues, setGrammarIssues] = useState<GrammarIssue[]>([]);
  const [grammarSummary, setGrammarSummary] = useState<any>(null);

  const [claimAnalyses, setClaimAnalyses] = useState<ClaimAnalysis[]>([]);
  const [claimSummary, setClaimSummary] = useState<any>(null);

  const [plagiarismReport, setPlagiarismReport] = useState<any>(null);

  const [aiResult, setAiResult] = useState<any>(null);

  const [citationStyles, setCitationStyles] = useState<CitationStyle[]>([]);
  const [selectedStyle, setSelectedStyle] = useState('apa-ghana');
  const [citationInput, setCitationInput] = useState({ title: '', authors: '', year: '', journal: '', volume: '', issue: '', pages: '', doi: '' });
  const [formattedCitation, setFormattedCitation] = useState<any>(null);
  // Removed unused bibliography state
  const [bibliographyEntries, setBibliographyEntries] = useState('');

  const [disclosureTemplates, setDisclosureTemplates] = useState<DisclosureTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const [uploadedPdfs, setUploadedPdfs] = useState<any[]>([]);
  const [selectedPdfs, setSelectedPdfs] = useState<string[]>([]);
  const [pdfQuestion, setPdfQuestion] = useState('');
  const [pdfChatResults, setPdfChatResults] = useState<any>(null);

  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<any>(null);
  const [selectedBlueprintType, setSelectedBlueprintType] = useState('university');

  useEffect(() => {
    adminApi.get('/writing-assist/citation-styles').then(res => setCitationStyles(res.data.styles));
    adminApi.get('/writing-assist/disclosure-templates').then(res => setDisclosureTemplates(res.data.templates));
    adminApi.get('/writing-assist/pdf/list').then(res => setUploadedPdfs(res.data.pdfs));
    adminApi.get('/blueprints').then(res => setBlueprints(res.data.blueprints || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'blueprints' && selectedBlueprintType) {
      adminApi.get(`/blueprints/${selectedBlueprintType}`).then(res => setSelectedBlueprint(res.data)).catch(() => {});
    }
  }, [activeTab, selectedBlueprintType]);

  const handleGrammarCheck = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await adminApi.post('/writing-assist/check-grammar', { text });
      setGrammarIssues(res.data.issues);
      setGrammarSummary(res.data.summary);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleClaimValidation = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await adminApi.post('/writing-assist/validate-claims', { text });
      setClaimAnalyses(res.data.analyses);
      setClaimSummary(res.data.summary);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const handlePlagiarismCheck = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await adminApi.post('/writing-assist/check-plagiarism', { text });
      setPlagiarismReport(res.data);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleAIDetect = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await adminApi.post('/writing-assist/detect-ai', { text });
      setAiResult(res.data);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleFormatCitation = async () => {
    setLoading(true);
    try {
      const citation = { ...citationInput, authors: citationInput.authors.split(',').map(a => a.trim()), year: parseInt(citationInput.year) || 2024 };
      const res = await adminApi.post('/writing-assist/format-citation', { citation, style: selectedStyle });
      setFormattedCitation(res.data);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleAddToBibliography = () => {
    const citation = { ...citationInput, authors: citationInput.authors.split(',').map(a => a.trim()), year: parseInt(citationInput.year) || 2024 };
    const newEntry = `${citation.authors.join(', ')} (${citation.year}). ${citation.title}.${citation.journal ? ' ' + citation.journal + '.' : ''}`;
    setBibliographyEntries(prev => prev + '\n\n' + newEntry);
    setCitationInput({ title: '', authors: '', year: '', journal: '', volume: '', issue: '', pages: '', doi: '' });
    setFormattedCitation(null);
  };

  const handlePdfChat = async () => {
    if (!pdfQuestion.trim() || selectedPdfs.length === 0) return;
    setLoading(true);
    try {
      const res = await adminApi.post('/writing-assist/pdf/chat', { pdfIds: selectedPdfs, question: pdfQuestion });
      setPdfChatResults(res.data);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const textContent = await file.text();
      const res = await adminApi.post('/writing-assist/pdf/upload', { fileName: file.name, text: textContent });
      setUploadedPdfs(prev => [...prev, res.data]);
    } catch (err: any) { alert(err.response?.data?.error || 'Upload failed'); }
    finally { setLoading(false); }
  };

  const getConfidenceColor = (c: string) => {
    switch (c) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'unsupported': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityColor = (s: string) => {
    switch (s) {
      case 'error': return 'bg-red-50 border-l-red-500';
      case 'warning': return 'bg-yellow-50 border-l-yellow-500';
      case 'suggestion': return 'bg-blue-50 border-l-blue-500';
      default: return 'bg-gray-50 border-l-gray-500';
    }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'grammar', label: 'Grammar', icon: '📝' },
    { id: 'claims', label: 'Claims', icon: '✓' },
    { id: 'plagiarism', label: 'Plagiarism', icon: '🔍' },
    { id: 'ai-detect', label: 'AI Detect', icon: '🤖' },
    { id: 'citations', label: 'Citations', icon: '📚' },
    { id: 'pdf-chat', label: 'PDF Chat', icon: '📄' },
    { id: 'blueprints', label: 'Blueprints', icon: '🏗️' },
  ];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Writing Assistant</h1>
        <p className="text-gray-500 mt-1">AI-powered academic writing tools</p>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {activeTab !== 'citations' && activeTab !== 'pdf-chat' && (
            <div className="bg-white rounded-lg shadow border p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your academic text here..."
                className="w-full h-64 p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-3 flex gap-3">
                {activeTab === 'grammar' && (
                  <button onClick={handleGrammarCheck} disabled={loading || !text.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300">
                    {loading ? 'Checking...' : 'Check Grammar'}
                  </button>
                )}
                {activeTab === 'claims' && (
                  <button onClick={handleClaimValidation} disabled={loading || !text.trim()}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-purple-300">
                    {loading ? 'Validating...' : 'Validate Claims'}
                  </button>
                )}
                {activeTab === 'plagiarism' && (
                  <button onClick={handlePlagiarismCheck} disabled={loading || !text.trim()}
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-orange-300">
                    {loading ? 'Checking...' : 'Check Plagiarism'}
                  </button>
                )}
                {activeTab === 'ai-detect' && (
                  <button onClick={handleAIDetect} disabled={loading || !text.trim()}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-red-300">
                    {loading ? 'Analyzing...' : 'Detect AI Content'}
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'grammar' && grammarIssues.length > 0 && (
            <div className="mt-4 bg-white rounded-lg shadow border">
              <div className="p-4 border-b"><h3 className="font-semibold">Grammar Issues ({grammarIssues.length})</h3></div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {grammarIssues.map((issue, idx) => (
                  <div key={idx} className={`p-4 border-l-4 ${getSeverityColor(issue.severity)}`}>
                    <p className="text-sm font-medium">{issue.message}</p>
                    <p className="text-xs text-gray-500 mt-1">Rule: {issue.rule}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">{issue.original}</span>
                      <span className="text-xs text-gray-400">→</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{issue.suggestion}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'claims' && claimAnalyses.length > 0 && (
            <div className="mt-4 bg-white rounded-lg shadow border">
              <div className="p-4 border-b"><h3 className="font-semibold">Claim Analysis ({claimAnalyses.length})</h3></div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {claimAnalyses.map((a, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm flex-1">"{a.claim}"</p>
                      <span className={`text-xs px-2 py-1 rounded border ${getConfidenceColor(a.confidence)}`}>{a.confidence}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">{a.explanation}</p>
                    {a.suggestions.map((s, si) => <p key={si} className="text-xs text-blue-600 mt-1">• {s}</p>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'plagiarism' && plagiarismReport && (
            <div className="mt-4 bg-white rounded-lg shadow border p-4">
              <h3 className="font-semibold mb-3">Plagiarism Report</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">{plagiarismReport.totalWords}</div>
                  <div className="text-xs text-gray-500">Total Words</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-orange-600">{plagiarismReport.matchCount}</div>
                  <div className="text-xs text-gray-500">Matches Found</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-red-600">{Math.round(plagiarismReport.overallSimilarity * 100)}%</div>
                  <div className="text-xs text-gray-500">Similarity</div>
                </div>
              </div>
              {plagiarismReport.sources?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Sources Matched</h4>
                  {plagiarismReport.sources.map((s: any, i: number) => (
                    <div key={i} className="text-xs p-2 bg-gray-50 rounded mb-1">
                      {s.name} ({s.matchCount} matches)
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ai-detect' && aiResult && (
            <div className="mt-4 bg-white rounded-lg shadow border p-4">
              <h3 className="font-semibold mb-3">AI Detection Results</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 bg-gray-50 rounded">
                  <div className="text-3xl font-bold text-red-600">{aiResult.aiScore}%</div>
                  <div className="text-sm text-gray-500">AI Content</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded">
                  <div className="text-3xl font-bold text-green-600">{aiResult.humanScore}%</div>
                  <div className="text-sm text-gray-500">Human Content</div>
                </div>
              </div>
              <div className={`p-3 rounded mb-4 ${aiResult.isLikelyAI ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                {aiResult.recommendation}
              </div>
              {aiResult.indicators?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Indicators</h4>
                  {aiResult.indicators.map((ind: any, i: number) => (
                    <div key={i} className={`text-xs p-2 rounded mb-1 border-l-4 ${
                      ind.severity === 'high' ? 'border-red-500 bg-red-50' :
                      ind.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                      'border-blue-500 bg-blue-50'
                    }`}>
                      {ind.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'citations' && (
            <div className="bg-white rounded-lg shadow border p-4">
              <h3 className="font-semibold mb-3">Citation Formatter</h3>
              <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full p-2 border rounded mb-3">
                {citationStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Title" value={citationInput.title} onChange={e => setCitationInput(p => ({...p, title: e.target.value}))} className="p-2 border rounded text-sm" />
                <input placeholder="Authors (comma separated)" value={citationInput.authors} onChange={e => setCitationInput(p => ({...p, authors: e.target.value}))} className="p-2 border rounded text-sm" />
                <input placeholder="Year" value={citationInput.year} onChange={e => setCitationInput(p => ({...p, year: e.target.value}))} className="p-2 border rounded text-sm" />
                <input placeholder="Journal" value={citationInput.journal} onChange={e => setCitationInput(p => ({...p, journal: e.target.value}))} className="p-2 border rounded text-sm" />
                <input placeholder="Volume" value={citationInput.volume} onChange={e => setCitationInput(p => ({...p, volume: e.target.value}))} className="p-2 border rounded text-sm" />
                <input placeholder="Pages" value={citationInput.pages} onChange={e => setCitationInput(p => ({...p, pages: e.target.value}))} className="p-2 border rounded text-sm" />
                <input placeholder="DOI" value={citationInput.doi} onChange={e => setCitationInput(p => ({...p, doi: e.target.value}))} className="p-2 border rounded text-sm col-span-2" />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleFormatCitation} disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300">
                  Format Citation
                </button>
                <button onClick={handleAddToBibliography}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  Add to Bibliography
                </button>
              </div>
              {formattedCitation && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <p className="text-sm font-medium mb-1">In-Text:</p>
                  <p className="text-sm text-blue-600">{formattedCitation.inText}</p>
                  <p className="text-sm font-medium mt-2 mb-1">Bibliography Entry:</p>
                  <p className="text-sm">{formattedCitation.bibliography}</p>
                </div>
              )}
              {bibliographyEntries && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <p className="text-sm font-medium mb-2">Bibliography:</p>
                  <pre className="text-xs whitespace-pre-wrap">{bibliographyEntries}</pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pdf-chat' && (
            <div className="bg-white rounded-lg shadow border p-4">
              <h3 className="font-semibold mb-3">PDF Chat</h3>
              <div className="mb-3">
                <input type="file" accept=".pdf,.txt" onChange={handlePdfUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
              {uploadedPdfs.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium mb-2">Uploaded PDFs:</p>
                  {uploadedPdfs.map(pdf => (
                    <label key={pdf.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" checked={selectedPdfs.includes(pdf.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPdfs(p => [...p, pdf.id]);
                          else setSelectedPdfs(p => p.filter(id => id !== pdf.id));
                        }} />
                      <span className="text-sm">{pdf.name}</span>
                      <span className="text-xs text-gray-400">({pdf.chunks} chunks)</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input value={pdfQuestion} onChange={(e) => setPdfQuestion(e.target.value)}
                  placeholder="Ask a question about the PDFs..."
                  className="flex-1 p-2 border rounded-lg text-sm" />
                <button onClick={handlePdfChat} disabled={loading || !pdfQuestion.trim() || selectedPdfs.length === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-purple-300">
                  {loading ? 'Searching...' : 'Ask'}
                </button>
              </div>
              {pdfChatResults && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">{pdfChatResults.message}</p>
                  {pdfChatResults.sources?.map((s: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 rounded mb-2 text-xs">
                      <p className="font-medium">{s.pdfName} - Page {s.pageNumber}</p>
                      <p className="text-gray-600 mt-1">{s.relevantText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'blueprints' && (
            <div className="bg-white rounded-lg shadow border p-4">
              <h3 className="font-semibold mb-3">Paper Builder Blueprints</h3>
              <p className="text-xs text-gray-500 mb-4">Real patterns extracted from {blueprints.reduce((sum, b) => sum + (b.sampleSize || 0), 0)}+ Ghanaian theses and care studies across KNUST, UG, UCC, UEW, Ashesi, and Holy Family NMTC Berekum.</p>

              <div className="flex gap-2 mb-4 overflow-x-auto">
                {blueprints.map(bp => (
                  <button key={bp.institutionType} onClick={() => setSelectedBlueprintType(bp.institutionType)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      selectedBlueprintType === bp.institutionType ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {bp.institutionType === 'university' ? '🎓 University' :
                     bp.institutionType === 'nmtc' ? '🏥 NMTC' :
                     bp.institutionType === 'education' ? '📚 Education' :
                     '🔧 Technical'}
                  </button>
                ))}
              </div>

              {selectedBlueprint && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-800">{selectedBlueprint.description}</p>
                    <p className="text-[10px] text-blue-600 mt-1">Based on {selectedBlueprint.sampleSize} documents</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Chapter Structure</h4>
                    <div className="space-y-2">
                      {Object.entries(selectedBlueprint.chapterPatterns || {}).map(([key, ch]: [string, any]) => (
                        <div key={key} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-800">{ch.title}</span>
                            <span className="text-[10px] text-gray-500">~{ch.avgWordCount} words</span>
                          </div>
                          <p className="text-[10px] text-gray-600 mb-1">{ch.writingPattern}</p>
                          <div className="flex gap-2 text-[10px]">
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded">Tense: {ch.tense}</span>
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded">Voice: {ch.voice}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {ch.sections?.map((s: string, i: number) => (
                              <span key={i} className="text-[10px] bg-gray-50 px-1.5 py-0.5 rounded border">{s}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Writing Patterns</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">Avg sentence length:</span>{' '}
                        <span className="font-medium">{selectedBlueprint.structural?.avgParagraphLength || 80} words/para</span>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">Avg sentences/para:</span>{' '}
                        <span className="font-medium">{selectedBlueprint.structural?.avgSentencesPerParagraph || 4}</span>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">Ghanaian sources:</span>{' '}
                        <span className="font-medium">{selectedBlueprint.citation?.avgGhanaianSourcesPercent || 28}%</span>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">Avg references:</span>{' '}
                        <span className="font-medium">{selectedBlueprint.citation?.avgTotalReferences || 30}</span>
                      </div>
                    </div>
                  </div>

                  {selectedBlueprint.examples && Object.keys(selectedBlueprint.examples).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Real Writing Examples</h4>
                      <div className="space-y-2">
                        {Object.entries(selectedBlueprint.examples).map(([key, example]: [string, any]) => (
                          <div key={key} className="bg-gray-50 border-l-4 border-blue-400 p-3 rounded-r">
                            <p className="text-[10px] font-medium text-gray-500 mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                            <p className="text-xs text-gray-700 leading-relaxed italic">"{example}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-4">
          {grammarSummary && (
            <div className="bg-white rounded-lg shadow border p-4">
              <h3 className="font-semibold mb-3">Grammar Summary</h3>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-blue-600">{grammarSummary.score}</div>
                <div className="text-sm text-gray-500">Score</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-red-600">Errors</span><span>{grammarSummary.errors}</span></div>
                <div className="flex justify-between"><span className="text-yellow-600">Warnings</span><span>{grammarSummary.warnings}</span></div>
                <div className="flex justify-between"><span className="text-blue-600">Suggestions</span><span>{grammarSummary.suggestions}</span></div>
              </div>
            </div>
          )}

          {claimSummary && (
            <div className="bg-white rounded-lg shadow border p-4">
              <h3 className="font-semibold mb-3">Claim Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total</span><span className="font-bold">{claimSummary.total}</span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span>High</span><span>{claimSummary.high}</span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span>Medium</span><span>{claimSummary.medium}</span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-full"></span>Low</span><span>{claimSummary.low}</span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span>Unsupported</span><span>{claimSummary.unsupported}</span></div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow border p-4">
            <h3 className="font-semibold mb-3">Features</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full"></span>Grammar & Style</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-purple-500 rounded-full"></span>Claim Validation</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-orange-500 rounded-full"></span>Plagiarism Check</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span>AI Detection</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full"></span>Citation Styles</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span>PDF Chat</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span>Blueprints</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border p-4">
            <h3 className="font-semibold mb-2">Disclosure Templates</h3>
            <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full p-2 border rounded text-sm mb-2">
              <option value="">Select template...</option>
              {disclosureTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {selectedTemplate && (
              <div className="p-3 bg-gray-50 rounded text-xs">
                {disclosureTemplates.find(t => t.id === selectedTemplate)?.content}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
