import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: string[];
  roles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles, roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const restrictedRoles = roles ?? allowedRoles;
  if (restrictedRoles && user && !restrictedRoles.includes(user.role_code)) {
    // Super admins trying to access salon portal → redirect to admin
    if (user.role_code === 'super_admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/billing" replace />;
  }

  return children;
}
