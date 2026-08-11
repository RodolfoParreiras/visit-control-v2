import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'wouter';

export default function Home() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  if (user) {
    return <Redirect to={user.role === 'attendant' ? '/service-center' : '/dashboard'} />;
  }
  
  return <Redirect to="/login" />;
}
