import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  useGetVisitsReport,
  useListSectors,
  useListUsers
} from '@visit-control/api-client';
import { CalendarDays, CircleUserRound, FileBarChart, Download, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateOnly } from '@/lib/utils';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Label } from '@/components/ui/label';
import { maskCpf } from '@/lib/cpf';

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
    doc.text('Relatório de Visitas - Prefeitura Municipal de Paraíba do Sul', 14, 15);
    
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
      <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#012c61]">
              <FileBarChart className="h-8 w-8" />
              Relatórios
            </h1>
            <p className="mt-1 text-slate-500">Extração de dados e auditoria de fluxo de pessoas.</p>
          </div>
          <div className="hidden text-right text-sm text-slate-500 sm:block">
            <div className="flex items-center justify-end gap-2 font-semibold text-slate-600">
              <span>Olá, {user?.name}</span>
              <CircleUserRound className="h-5 w-5" />
            </div>
            <div className="mt-2 flex items-center justify-end gap-2">
              <span>{format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
        </div>

        <Card className="border-slate-200 p-5 shadow-sm sm:p-6">
          <div className={`grid grid-cols-1 items-end gap-4 md:grid-cols-2 ${user?.role === 'admin' ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
              <div className="space-y-2">
                <Label htmlFor="report-date-from" className="text-sm font-semibold text-[#012c61]">Data Inicial</Label>
                <Input id="report-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-lg border-slate-300 bg-white focus-visible:ring-[#174f8c]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-date-to" className="text-sm font-semibold text-[#012c61]">Data Final</Label>
                <Input id="report-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-lg border-slate-300 bg-white focus-visible:ring-[#174f8c]" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#012c61]">Setor</Label>
                <Select value={sectorId} onValueChange={setSectorId}>
                  <SelectTrigger className="h-11 rounded-lg border-slate-300 bg-white focus:ring-[#174f8c]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Setores</SelectItem>
                    {sectors?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {user?.role === 'admin' && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#012c61]">Recepcionista (Entrada)</Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger className="h-11 rounded-lg border-slate-300 bg-white focus:ring-[#174f8c]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Usuários</SelectItem>
                      {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#012c61]">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-11 rounded-lg border-slate-300 bg-white focus:ring-[#174f8c]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="ongoing">Em andamento</SelectItem>
                    <SelectItem value="finished">Finalizado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-[#012c61]">Registros encontrados</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {report?.total || 0} {(report?.total || 0) === 1 ? 'registro' : 'registros'}
                </p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="outline" onClick={handleExportPDF} disabled={!visits.length} className="h-11 flex-1 gap-2 rounded-lg border-red-400 bg-white px-5 text-slate-900 hover:bg-red-50 hover:text-red-700 sm:flex-none">
                  <FileText className="h-4 w-4 text-red-600" /> Exportar PDF
                </Button>
                <Button variant="outline" onClick={handleExportExcel} disabled={!visits.length} className="h-11 flex-1 gap-2 rounded-lg border-green-500 bg-white px-5 text-green-700 hover:bg-green-50 hover:text-green-800 sm:flex-none">
                  <Download className="h-4 w-4" /> Exportar Excel
                </Button>
              </div>
            </div>

          <div className="max-h-[500px] overflow-auto">
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[7%]">ID</TableHead>
                  <TableHead className="w-[13%]">Data</TableHead>
                  <TableHead className="w-[25%]">Visitante</TableHead>
                  <TableHead className="w-[15%]">CPF</TableHead>
                  <TableHead className="w-[13%]">Setor</TableHead>
                  <TableHead className="w-[10%]">Entrada</TableHead>
                  <TableHead className="w-[9%]">Saída</TableHead>
                  <TableHead className="w-[13%]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-gray-500">Gerando relatório...</TableCell>
                  </TableRow>
                ) : visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-gray-500">Nenhum dado encontrado para os filtros selecionados.</TableCell>
                  </TableRow>
                ) : (
                  visits.map((visit) => (
                    <TableRow key={visit.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono text-xs text-gray-500">#{visit.id}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatDateOnly(visit.entryDate)}</TableCell>
                      <TableCell className="truncate font-medium" title={visit.visitor?.name}>{visit.visitor?.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{visit.visitor?.cpf ? maskCpf(visit.visitor.cpf) : '-'}</TableCell>
                      <TableCell className="truncate text-sm" title={visit.sector?.name}>{visit.sector?.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{visit.entryTime}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{visit.exitTime || '-'}</TableCell>
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
