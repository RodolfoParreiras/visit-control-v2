import { ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';

export function AppLayout({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const events = new EventSource('/api/service/display/events');
    events.addEventListener('update', () => {
      queryClient.invalidateQueries({ refetchType: 'active' });
    });
    return () => events.close();
  }, [queryClient]);

  return (
    <div className="flex min-h-[100dvh] w-full bg-background no-print">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
