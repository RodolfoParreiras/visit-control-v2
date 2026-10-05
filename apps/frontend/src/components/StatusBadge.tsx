import React from 'react';

export const visitStatusLabels: Record<string, string> = {
  waiting: 'Aguardando atendimento',
  ongoing: 'Em andamento',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export function StatusBadge({ status, role, active }: { status?: string, role?: string, active?: string }) {
  if (status) {
    switch (status) {
      case 'waiting':
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Aguardando atendimento</span>;
      case 'ongoing':
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Em andamento</span>;
      case 'finished':
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Finalizado</span>;
      case 'cancelled':
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Cancelado</span>;
      default:
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  }

  if (active) {
    switch (active) {
      case 'active':
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ativo</span>;
      case 'inactive':
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">Inativo</span>;
      default:
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">{active}</span>;
    }
  }

  if (role) {
    switch (role) {
      case 'admin':
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">Administrador</span>;
      case 'receptionist':
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">Recepcionista</span>;
      case 'attendant':
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Atendente</span>;
      default:
        return <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">{role}</span>;
    }
  }

  return null;
}
