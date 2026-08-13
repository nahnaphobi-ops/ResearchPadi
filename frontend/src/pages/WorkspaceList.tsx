import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workspaceService } from '../services/workspaceService';
import { subscriptionService } from '../services/subscriptionService';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import Navbar from '../components/layout/Navbar';
import { FilePenLine, Plus, Trash2 } from 'lucide-react';

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
      } catch (err: any) {
        if (err.response?.status === 403) {
          navigate('/subscribe');
        } else {
          setError(err.response?.data?.error || 'Failed to load sessions');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this session?')) return;
    try {
      await workspaceService.deleteSession(id);
      setSessions(sessions.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col app-shell">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Loading workspace...</p>
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
            <div className="p-3 mb-4 text-red-700 bg-red-100 rounded-lg">{error}</div>
          )}

          {showForm && (
            <form onSubmit={handleCreate} className="bg-white rounded-[14px] shadow-soft p-6 mb-8 border border-rule">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 font-medium text-sm">Session Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Effects of Social Media on Student Performance"
                    className="w-full p-3 border-2 rounded-lg focus:border-gray-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-sm">Course (optional)</label>
                  <input
                    type="text"
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    placeholder="e.g. BSc. Computer Science"
                    className="w-full p-3 border-2 rounded-lg focus:border-gray-500 outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="btn-primary mt-4 px-6 py-3 text-sm disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Session'}
              </button>
            </form>
          )}

          {sessions.length === 0 ? (
            <div className="text-center py-16">
              <FilePenLine className="mx-auto mb-4 text-navy" size={38} />
              <h3 className="text-xl font-bold text-navy mb-2">No sessions yet</h3>
              <p className="text-muted mb-6">Create your first workspace session to start writing with AI.</p>
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary px-6 py-3 text-sm"
              >
                Create First Session
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => navigate(`/workspace/${session.id}`)}
                  className="group bg-white rounded-[14px] shadow-soft p-6 border border-rule hover:border-navy hover:-translate-y-0.5 transition cursor-pointer"
                >
                    <h3 className="font-bold text-lg mb-1 truncate text-ink group-hover:text-navy">
                    {session.title || 'Untitled Session'}
                  </h3>
                  {session.course && (
                    <p className="text-sm text-gray-800 mb-2">{session.course}</p>
                  )}
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {session.content
                      ? `${session.content.substring(0, 100)}...`
                      : 'Empty session'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {new Date(session.updated_at).toLocaleDateString()}
                    </span>
                      <button
                      onClick={(e) => handleDelete(session.id, e)}
                       className="text-xs text-gray-400 hover:text-red-600 font-medium inline-flex items-center gap-1"
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
    </div>
  );
}
