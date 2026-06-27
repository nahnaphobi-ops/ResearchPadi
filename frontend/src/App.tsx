import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
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
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminTransactions = lazy(() => import('./pages/admin/Transactions'));
const AdminSubscriptions = lazy(() => import('./pages/admin/Subscriptions'));
const AdminPapers = lazy(() => import('./pages/admin/Papers'));
const AdminWritingAssist = lazy(() => import('./pages/admin/WritingAssist'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

function App() {
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
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedAdminRoute><AdminOverview /></ProtectedAdminRoute>} />
          <Route path="/admin/users" element={<ProtectedAdminRoute><AdminUsers /></ProtectedAdminRoute>} />
          <Route path="/admin/transactions" element={<ProtectedAdminRoute><AdminTransactions /></ProtectedAdminRoute>} />
          <Route path="/admin/subscriptions" element={<ProtectedAdminRoute><AdminSubscriptions /></ProtectedAdminRoute>} />
          <Route path="/admin/papers" element={<ProtectedAdminRoute><AdminPapers /></ProtectedAdminRoute>} />
          <Route path="/admin/writing-assist" element={<ProtectedAdminRoute><AdminWritingAssist /></ProtectedAdminRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
