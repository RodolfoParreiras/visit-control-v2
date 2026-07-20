import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useListAuditLogs, AuditLog } from '@visit-control/api-client';
import { Shield, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const { data: response, isLoading } = useListAuditLogs({
    page,
    limit: 20,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const logs = response?.data || [];
  const total = response?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Auditoria
          </h1>
          <p className="text-gray-500 mt-1">Registro de todas as ações realizadas no sistema.</p>
        </div>

        <Card>
          <CardContent className="p-4 flex gap-4 bg-gray-50/50 border-b">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Data Inicial</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Data Final</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="gap-2" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>
                <Filter className="w-4 h-4" /> Limpar
              </Button>
            </div>
          </CardContent>

          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[180px]">Data / Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>IP</TableHead>
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
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{log.user?.name}</div>
                      <div className="text-xs text-gray-500">{log.user?.login}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-semibold text-gray-700">{log.entityType}</span>
                        {log.entityId && <span className="text-gray-500 ml-1">#{log.entityId}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{log.ipAddress}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
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
