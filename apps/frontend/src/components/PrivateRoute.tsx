import { Redirect, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

interface PrivateRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
  allowPasswordChange?: boolean;
}

export function PrivateRoute({ children, adminOnly = false, allowPasswordChange = false }: PrivateRouteProps) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-muted-foreground">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  }

  if (user.mustChangePassword && !allowPasswordChange) {
    return <Redirect to="/change-password" />;
  }

  if (!user.mustChangePassword && allowPasswordChange) {
    return <Redirect to={user.role === 'attendant' ? '/service-center' : '/dashboard'} />;
  }

  if (user.role === 'attendant' && !allowPasswordChange && location !== '/service-center') {
    return <Redirect to="/service-center" />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}
