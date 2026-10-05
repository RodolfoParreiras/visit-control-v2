import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'wouter';
import { homePath } from '@/lib/permissions';

export default function Home() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  if (user) {
    return <Redirect to={homePath(user)} />;
  }
  
  return <Redirect to="/login" />;
}
