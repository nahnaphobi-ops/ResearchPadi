import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

/** Admins use the normal phone login; the API makes the real check on every admin request. */
export default function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(state => state.token);
  const isAdmin = useAuthStore(state => state.user?.is_admin);

  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
