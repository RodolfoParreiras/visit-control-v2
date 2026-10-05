import { ReactNode, useCallback } from 'react';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { canUseServiceCenter } from '@/lib/permissions';
import { useServiceEvents } from '@/lib/realtime';

type DesktopBridge = {
  notifyQueueEntry?: () => void;
};

// Somente os dados afetados pela fila são recarregados a cada evento; recarregar
// tudo em todas as telas abertas multiplicava as requisições ao servidor.
const QUEUE_DEPENDENT_PREFIXES = ['/api/visits', '/api/visitors', '/api/dashboard', 'service-central', 'service-display'];

const dependsOnQueue = (query: Query) => {
  const root = query.queryKey[0];
  return typeof root === 'string' && QUEUE_DEPENDENT_PREFIXES.some((prefix) => root.startsWith(prefix));
};

/** Mantém uma única conexão de tempo real enquanto houver um usuário logado. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ predicate: dependsOnQueue, refetchType: 'active' });
  }, [queryClient]);

  useServiceEvents(
    {
      onResync: refresh,
      onEvent: (event, data) => {
        if (event === 'update') refresh();
        if (event !== 'queue-entry' || !user || !canUseServiceCenter(user)) return;

        const entry = data as { queueId?: number; sectorId?: number } | null;
        if (!entry || user.sectorId !== entry.sectorId) return;

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
      },
    },
    Boolean(user),
  );

  return <>{children}</>;
}
