import { Navigate } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore';

export default function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const token = useAdminStore(state => state.token);

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
