import { ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

type QueueEntryEvent = {
  queueId: number;
  sectorId: number;
};

type DesktopBridge = {
  notifyQueueEntry?: () => void;
};

export function AppLayout({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    const events = new EventSource('/api/service/display/events');
    events.addEventListener('update', () => {
      queryClient.invalidateQueries({ refetchType: 'active' });
    });
    events.addEventListener('queue-entry', async (event) => {
      if (user?.role !== 'attendant') return;

      try {
        const entry = JSON.parse(event.data) as QueueEntryEvent;
        if (user.sectorId !== entry.sectorId) return;

        const desktopApp = (window as Window & { desktopApp?: DesktopBridge }).desktopApp;
        if (desktopApp?.notifyQueueEntry) {
          desktopApp.notifyQueueEntry();
        } else if ('Notification' in window && window.Notification.permission === 'granted') {
          const notification = new window.Notification('Novo visitante na fila', {
            body: 'Há um novo visitante aguardando atendimento.',
            icon: '/icone-prefeitura.png?v=20260902',
            tag: `queue-entry-${entry.queueId}`,
          });
          notification.onclick = () => window.focus();
        }
      } catch {
        // Ignora eventos incompletos sem interromper as atualizações em tempo real.
      }
    });
    return () => events.close();
  }, [queryClient, user?.role, user?.sectorId]);

  return (
    <div className="flex min-h-[100dvh] w-full bg-background no-print">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
