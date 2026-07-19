import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workspaceService } from '../services/workspaceService';
import { subscriptionService } from '../services/subscriptionService';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import Navbar from '../components/layout/Navbar';

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
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Workspace</h1>
              <p className="text-gray-600 mt-1">Write with real-time AI assistance</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-3 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900 transition"
            >
              {showForm ? 'Cancel' : '+ New Session'}
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 text-red-700 bg-red-100 rounded-lg">{error}</div>
          )}

          {showForm && (
            <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-lg p-6 mb-8">
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
                className="mt-4 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-green-300 transition"
              >
                {creating ? 'Creating...' : 'Create Session'}
              </button>
            </form>
          )}

          {sessions.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">✍️</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">No sessions yet</h3>
              <p className="text-gray-500 mb-6">Create your first workspace session to start writing with AI.</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900 transition"
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
                  className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100 border-gray-200 transition cursor-pointer"
                >
                  <h3 className="font-bold text-lg mb-1 truncate">
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
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
