import { Redirect, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { ReactNode } from 'react';
import { can, homePath, type PermissionKey } from '@/lib/permissions';

interface PrivateRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
  /** Basta ter uma das permissões listadas. */
  permission?: PermissionKey | PermissionKey[];
  allowPasswordChange?: boolean;
}

export function PrivateRoute({ children, adminOnly = false, permission, allowPasswordChange = false }: PrivateRouteProps) {
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
    return <Redirect to={homePath(user)} />;
  }

  const permissions = permission === undefined ? [] : Array.isArray(permission) ? permission : [permission];
  const allowed =
    (!adminOnly || user.role === 'admin') &&
    (permissions.length === 0 || can(user, ...permissions));
  if (!allowed) {
    const fallback = homePath(user);
    return fallback === location ? null : <Redirect to={fallback} />;
  }

  return <>{children}</>;
}
