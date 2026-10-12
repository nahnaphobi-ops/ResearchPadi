import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useIdleLogout } from './hooks/useIdleLogout';
import { authService } from './services/apiService';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';

// Lazy-loaded pages for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Wallet = lazy(() => import('./pages/Wallet'));
const NewPaper = lazy(() => import('./pages/NewPaper'));
const FullPaperForm = lazy(() => import('./pages/FullPaperForm'));
const PaperDetails = lazy(() => import('./pages/PaperDetails'));
const PaperReview = lazy(() => import('./pages/PaperReview'));
const Subscribe = lazy(() => import('./pages/Subscribe'));
const WorkspaceList = lazy(() => import('./pages/WorkspaceList'));
const WorkspaceEditor = lazy(() => import('./pages/WorkspaceEditor'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Reviews = lazy(() => import('./pages/Reviews'));
const ReviewDesk = lazy(() => import('./pages/ReviewDesk'));
const ReviewWork = lazy(() => import('./pages/ReviewWork'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews'));
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminTransactions = lazy(() => import('./pages/admin/Transactions'));
const AdminSubscriptions = lazy(() => import('./pages/admin/Subscriptions'));
const AdminPapers = lazy(() => import('./pages/admin/Papers'));
const AdminWritingAssist = lazy(() => import('./pages/admin/WritingAssist'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy"></div>
    </div>
  );
}

/** Refresh the signed-in user once per load so admin/reviewer roles granted later show up without signing out. */
function useRoleSync() {
  const userId = useAuthStore((state) => state.user?.id);
  const updateUser = useAuthStore((state) => state.updateUser);
  useEffect(() => {
    if (!userId) return;
    authService.getProfile().then((res) => updateUser(res.data)).catch(() => {});
  }, [userId, updateUser]);
}

function App() {
  useRoleSync();
  useIdleLogout();
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/new-paper" element={<ProtectedRoute><NewPaper /></ProtectedRoute>} />
          <Route path="/new-paper/full" element={<ProtectedRoute><FullPaperForm /></ProtectedRoute>} />
          <Route path="/papers/:id" element={<ProtectedRoute><PaperDetails /></ProtectedRoute>} />
          <Route path="/papers/:id/review" element={<ProtectedRoute><PaperReview /></ProtectedRoute>} />
          <Route path="/subscribe" element={<ProtectedRoute><Subscribe /></ProtectedRoute>} />
          <Route path="/workspace" element={<ProtectedRoute><WorkspaceList /></ProtectedRoute>} />
          <Route path="/workspace/:id" element={<ProtectedRoute><WorkspaceEditor /></ProtectedRoute>} />
          <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
          <Route path="/review-desk" element={<ProtectedRoute><ReviewDesk /></ProtectedRoute>} />
          <Route path="/review-desk/:id" element={<ProtectedRoute><ReviewWork /></ProtectedRoute>} />
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route path="/admin" element={<ProtectedAdminRoute><AdminOverview /></ProtectedAdminRoute>} />
          <Route path="/admin/users" element={<ProtectedAdminRoute><AdminUsers /></ProtectedAdminRoute>} />
          <Route path="/admin/transactions" element={<ProtectedAdminRoute><AdminTransactions /></ProtectedAdminRoute>} />
          <Route path="/admin/subscriptions" element={<ProtectedAdminRoute><AdminSubscriptions /></ProtectedAdminRoute>} />
          <Route path="/admin/papers" element={<ProtectedAdminRoute><AdminPapers /></ProtectedAdminRoute>} />
          <Route path="/admin/writing-assist" element={<ProtectedAdminRoute><AdminWritingAssist /></ProtectedAdminRoute>} />
          <Route path="/admin/reviews" element={<ProtectedAdminRoute><AdminReviews /></ProtectedAdminRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
