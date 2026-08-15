import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useListAuditLogs, useListUsers, AuditLog } from '@visit-control/api-client';
import { CalendarDays, CircleUserRound, Shield, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { ptBR } from 'date-fns/locale';

const actionLabels: Record<string, string> = {
  login: 'Login', call_next_visitor: 'Chamar próximo', register_entry: 'Registrar entrada',
  create_sector: 'Criar setor', update_sector: 'Editar setor', delete_sector: 'Excluir setor',
  create_user: 'Criar usuário', update_user: 'Editar usuário', delete_user: 'Excluir usuário',
  create_visitor: 'Cadastrar visitante', update_visitor: 'Editar visitante', update_visit: 'Editar visita',
  update_field_config: 'Configurar formulário', update_label_config: 'Configurar etiqueta',
};
const entityLabels: Record<string, string> = { user: 'Usuário', service_queue: 'Fila de atendimento', visit: 'Visita', visitor: 'Visitante', sector: 'Setor' };

export default function AuditLogs() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('all');
  const [action, setAction] = useState('all');
  const { data: users } = useListUsers();
  
  const { data: response, isLoading } = useListAuditLogs({
    page,
    limit: 20,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    userId: userId === 'all' ? undefined : Number(userId),
    action: action === 'all' ? undefined : action,
  });

  const logs = response?.data || [];
  const total = response?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div><h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#012c61]"><Shield className="h-8 w-8" />Auditoria</h1><p className="mt-1 text-slate-500">Registro de todas as ações realizadas no sistema.</p></div>
          <div className="hidden text-right text-sm text-slate-500 sm:block"><div className="flex items-center justify-end gap-2 font-semibold text-slate-600"><span>Olá, {user?.name}</span><CircleUserRound className="h-5 w-5" /></div><div className="mt-2 flex items-center justify-end gap-2"><span>{format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span><CalendarDays className="h-5 w-5" /></div></div>
        </div>

        <Card className="border-slate-200 p-5 shadow-sm sm:p-6">
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#012c61]">Data Inicial</Label>
                <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="h-11 rounded-lg border-slate-300 bg-white focus-visible:ring-[#174f8c]" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#012c61]">Data Final</Label>
                <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="h-11 rounded-lg border-slate-300 bg-white focus-visible:ring-[#174f8c]" />
              </div>
              <div className="space-y-2"><Label className="text-sm font-semibold text-[#012c61]">Usuário</Label><Select value={userId} onValueChange={(value) => { setUserId(value); setPage(1); }}><SelectTrigger className="h-11 rounded-lg border-slate-300 bg-white focus:ring-[#174f8c]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{users?.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-sm font-semibold text-[#012c61]">Ação</Label><Select value={action} onValueChange={(value) => { setAction(value); setPage(1); }}><SelectTrigger className="h-11 rounded-lg border-slate-300 bg-white focus:ring-[#174f8c]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{Object.entries(actionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <Button variant="outline" className="h-11 gap-2 rounded-lg border-slate-300 px-4 text-slate-600 hover:bg-slate-100" onClick={() => { setDateFrom(''); setDateTo(''); setUserId('all'); setAction('all'); setPage(1); }}>
                <Filter className="h-4 w-4" />Limpar filtros
              </Button>
            </div>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5"><h2 className="font-semibold text-[#012c61]">Registros de auditoria</h2><p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'registro' : 'registros'}</p></div>
          <div className="overflow-x-auto"><Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-[19%]">Data / Hora</TableHead><TableHead className="w-[20%]">Usuário</TableHead><TableHead className="w-[21%]">Ação</TableHead><TableHead className="w-[25%]">Entidade</TableHead><TableHead className="w-[15%]">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">Nenhum registro encontrado.</TableCell>
                </TableRow>
              ) : (
                logs.map((log: AuditLog) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/80">
                    <TableCell className="whitespace-nowrap text-sm text-slate-600">
                      {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{log.user?.name}</div>
                      <div className="text-xs text-gray-500">{log.user?.login}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-[#174f8c]/10 px-2.5 py-1 text-xs font-medium text-[#012c61]">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-semibold text-slate-700">{log.entityType ? (entityLabels[log.entityType] || log.entityType) : '—'}</span>
                        {log.entityId && <span className="text-gray-500 ml-1">#{log.entityId}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{log.ipAddress}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table></div>
          
          {totalPages > 1 && (
            <div className="p-4 flex items-center justify-between border-t">
              <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
              <div className="space-x-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </Card>

      </div>
    </AppLayout>
  );
}
