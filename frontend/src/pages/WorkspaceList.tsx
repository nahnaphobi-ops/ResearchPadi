import { useState, useEffect } from 'react';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';
import { useNavigate } from 'react-router-dom';
import { workspaceService } from '../services/workspaceService';
import { subscriptionService } from '../services/subscriptionService';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { FilePenLine, Plus, Trash2 } from 'lucide-react';

/** Workspace content is editor HTML; show a short plain-text preview. */
function previewText(html: string): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

export default function WorkspaceList() {
  const navigate = useNavigate();
  const { sessions, setSessions, setLoading, loading } = useWorkspaceStore();
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        setLoading(true);
        const [subRes, sessionsRes] = await Promise.all([
          subscriptionService.getActive(),
          workspaceService.listSessions(),
        ]);
        if (!subRes.data.isActive) {
          navigate('/subscribe');
          return;
        }
        setSessions(sessionsRes.data);
      } catch (err) {
        if (apiErrorStatus(err) === 403) {
          navigate('/subscribe');
        } else {
          setError(apiErrorMessage(err, 'Failed to load sessions'));
        }
      } finally {
        setLoading(false);
      }
    };
    checkAndLoad();
  }, [navigate, setSessions, setLoading]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await workspaceService.createSession({
        title: newTitle || 'Untitled Session',
        course: newCourse,
      });
      setSessions([res.data, ...sessions]);
      navigate(`/workspace/${res.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to create session'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this session? This cannot be undone.')) return;
    try {
      await workspaceService.deleteSession(id);
      setSessions(sessions.filter((s) => s.id !== id));
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col app-shell">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted">
            <div className="mx-auto mb-3 w-8 h-8 border-2 border-rule border-t-brand rounded-full animate-spin" />
            Loading workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <Navbar />
      <main className="flex-1 px-5 py-10 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-9">
            <div>
              <p className="eyebrow mb-2">Writing studio</p>
              <h1 className="text-4xl font-bold text-navy">Your workspace</h1>
              <p className="text-muted mt-2">A focused place to think, draft, and refine with real-time AI assistance.</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2"
            >
              {showForm ? 'Cancel' : <><Plus size={17} /> New session</>}
            </button>
          </div>

          {error && (
            <div role="alert" className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-[10px]">{error}</div>
          )}

          {showForm && (
            <form onSubmit={handleCreate} className="bg-white rounded-[14px] shadow-soft p-6 mb-8 border border-rule">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="session-title" className="block mb-1 font-medium text-sm text-ink">Session title</label>
                  <input
                    id="session-title"
                    type="text"
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Effects of Social Media on Student Performance"
                    className="w-full p-3 border rounded-[10px]"
                  />
                </div>
                <div>
                  <label htmlFor="session-course" className="block mb-1 font-medium text-sm text-ink">Course <span className="font-normal text-muted">(optional)</span></label>
                  <input
                    id="session-course"
                    type="text"
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    placeholder="e.g. BSc. Computer Science"
                    className="w-full p-3 border rounded-[10px]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="btn-primary mt-4 px-6 py-3 text-sm disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create session'}
              </button>
            </form>
          )}

          {sessions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[14px] border border-rule">
              <div className="w-16 h-16 bg-brand-soft rounded-2xl grid place-items-center mx-auto mb-5">
                <FilePenLine className="text-brand" size={28} />
              </div>
              <h3 className="text-xl font-bold text-navy mb-2">No sessions yet</h3>
              <p className="text-muted mb-6">Create your first workspace session to start writing with AI.</p>
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary px-6 py-3 text-sm"
              >
                Create your first session
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/workspace/${session.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/workspace/${session.id}`); }}
                  className="group flex flex-col bg-white rounded-[14px] shadow-soft p-6 border border-rule hover:border-brand/50 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand transition cursor-pointer"
                >
                  <h3 className="font-bold text-lg mb-1 truncate text-ink group-hover:text-brand transition">
                    {session.title || 'Untitled session'}
                  </h3>
                  {session.course && (
                    <p className="text-sm text-navy font-medium mb-2">{session.course}</p>
                  )}
                  <p className="text-sm text-muted mb-4 line-clamp-2">
                    {(session.content && previewText(session.content)) || 'Empty session'}
                  </p>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs text-muted">
                      Edited {new Date(session.updated_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => handleDelete(session.id, e)}
                      className="text-xs text-muted hover:text-red-600 font-medium inline-flex items-center gap-1 p-1 -m-1"
                      aria-label={`Delete ${session.title || 'untitled session'}`}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
