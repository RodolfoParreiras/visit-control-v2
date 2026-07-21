import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  useGetVisitsReport,
  useListSectors,
  useListUsers
} from '@visit-control/api-client';
import { FileBarChart, Download, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateOnly } from '@/lib/utils';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sectorId, setSectorId] = useState<string>('all');
  const [userId, setUserId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  const { data: sectors } = useListSectors();
  const { data: users } = useListUsers(undefined, {
    // A listagem de usuários é exclusiva de administradores.
    // Recepcionistas ainda podem emitir relatórios usando os demais filtros.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: user?.role === 'admin' } as any,
  });

  const { data: report, isLoading } = useGetVisitsReport({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sectorId: sectorId !== 'all' ? parseInt(sectorId, 10) : undefined,
    userId: userId !== 'all' ? parseInt(userId, 10) : undefined,
    status: status !== 'all' ? status as any : undefined,
  }, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: {} as any,
  });

  const visits = report?.visits || [];

  const handleExportExcel = () => {
    if (!visits.length) return;
    
    const exportData = visits.map(v => ({
      ID: v.id,
      Data: formatDateOnly(v.entryDate),
      Entrada: v.entryTime,
      Saida: v.exitTime || '',
      Visitante: v.visitor?.name,
      CPF: v.visitor?.cpf || '',
      Empresa: v.visitor?.company || '',
      Setor: v.sector?.name,
      Responsavel: v.responsible || '',
      Status: v.status === 'ongoing' ? 'Em andamento' : v.status === 'finished' ? 'Finalizado' : 'Cancelado',
      Motivo: v.reason || '',
      RegistradoPor: v.entryUser?.name || ''
    }));

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Relatório");
    writeFile(wb, `relatorio_visitas_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!visits.length) return;

    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text('Relatório de Visitas - Prefeitura Municipal', 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, 22);
    doc.text(`Total de registros: ${visits.length}`, 14, 28);

    const tableData = visits.map(v => [
      v.id,
      formatDateOnly(v.entryDate),
      v.entryTime,
      v.exitTime || '-',
      v.visitor?.name || '',
      v.visitor?.cpf || '-',
      v.sector?.name || '',
      v.status === 'ongoing' ? 'Em andamento' : v.status === 'finished' ? 'Finalizado' : 'Cancelado'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['ID', 'Data', 'Entrada', 'Saída', 'Visitante', 'CPF', 'Setor', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 60, 120] }, // A government blue color
      styles: { fontSize: 8 },
    });

    doc.save(`relatorio_visitas_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileBarChart className="w-8 h-8 text-primary" />
            Relatórios
          </h1>
          <p className="text-gray-500 mt-1">Extração de dados e auditoria de fluxo de pessoas.</p>
        </div>

        <Card>
          <CardContent className="p-4 bg-gray-50/50 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Data Inicial</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Data Final</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Setor</label>
                <Select value={sectorId} onValueChange={setSectorId}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Setores</SelectItem>
                    {sectors?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {user?.role === 'admin' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Recepcionista (Entrada)</label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Usuários</SelectItem>
                      {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="ongoing">Em andamento</SelectItem>
                    <SelectItem value="finished">Finalizado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700 bg-white px-3 py-1.5 rounded-md border shadow-sm">
                Total de Registros Encontrados: <span className="text-primary font-bold">{report?.total || 0}</span>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="outline" onClick={handleExportPDF} disabled={!visits.length} className="flex-1 sm:flex-none gap-2 bg-white">
                  <FileText className="w-4 h-4 text-red-600" /> Exportar PDF
                </Button>
                <Button variant="outline" onClick={handleExportExcel} disabled={!visits.length} className="flex-1 sm:flex-none gap-2 bg-white border-green-200 hover:bg-green-50 hover:text-green-700">
                  <Download className="w-4 h-4 text-green-600" /> Exportar Excel
                </Button>
              </div>
            </div>
          </CardContent>

          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Visitante</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-500">Gerando relatório...</TableCell>
                  </TableRow>
                ) : visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-500">Nenhum dado encontrado para os filtros selecionados.</TableCell>
                  </TableRow>
                ) : (
                  visits.map((visit) => (
                    <TableRow key={visit.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-xs text-gray-500">#{visit.id}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDateOnly(visit.entryDate)}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{visit.visitor?.name}</div>
                        {visit.visitor?.cpf && <div className="text-xs text-gray-500 font-mono">{visit.visitor.cpf}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{visit.sector?.name}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-500 whitespace-nowrap">
                        In: {visit.entryTime} <br />
                        Out: {visit.exitTime || '-'}
                      </TableCell>
                      <TableCell><StatusBadge status={visit.status} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
