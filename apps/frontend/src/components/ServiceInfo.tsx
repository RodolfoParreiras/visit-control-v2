import type { VisitService } from '@visit-control/api-client';

const time = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function PriorityBadge({ level, reason }: { level: number; reason?: string | null }) {
  if (!level) return null;
  return (
    <span
      title={reason ?? undefined}
      className={
        level >= 2
          ? 'inline-flex items-center whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800'
          : 'inline-flex items-center whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800'
      }
    >
      {level >= 2 ? 'Prioridade 80+' : 'Prioritário'}
    </span>
  );
}

/** Onde o visitante está sendo (ou foi) atendido, para a recepção acompanhar. */
export function serviceLocation(service: VisitService): string {
  if (service.status === 'waiting') return 'Na fila';
  if (service.status === 'cancelled') return 'Saiu da fila';
  const place = service.deskName ?? 'Chamada geral';
  return service.status === 'called' ? `${place} · em atendimento` : `Atendido: ${place}`;
}

/** Versão compacta usada na lista de visitas. */
export function ServiceCell({ service }: { service?: VisitService | null }) {
  if (!service) return <span className="text-slate-400">-</span>;
  return (
    <div className="min-w-0 space-y-1">
      <p
        className={
          service.status === 'called'
            ? 'text-sm font-semibold text-[#012c61]'
            : 'text-sm text-slate-600'
        }
        title={serviceLocation(service)}
      >
        {service.status === 'called' || service.status === 'completed'
          ? service.deskName ?? 'Chamada geral'
          : serviceLocation(service)}
      </p>
      {service.status === 'called' && service.calledAt && (
        <p className="text-xs text-slate-500">Chamado às {time(service.calledAt)}</p>
      )}
      {service.status === 'waiting' && (
        <PriorityBadge level={service.priorityLevel} reason={service.priorityReason} />
      )}
    </div>
  );
}

export { time as formatServiceTime };
