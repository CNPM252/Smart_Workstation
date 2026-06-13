import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ requireAdmin = false }) => {
  const { user, isGuest } = useAuth();

  if (!user && !isGuest) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin) {
    if (isGuest || user?.role !== 'ROLE_ADMIN') {
      return <Navigate to="/dashboard" replace />;
    }
  }
  else {
    if (user?.role === 'ROLE_ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;