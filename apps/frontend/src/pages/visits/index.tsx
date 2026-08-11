import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  useListVisits, 
  useListSectors, 
  useCheckoutVisit, 
  useCancelVisit,
  getListVisitsQueryKey
} from '@visit-control/api-client';
import { ClipboardList, Search, LogOut as CheckoutIcon, Ban, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatDateOnly } from '@/lib/utils';

function getTodayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

export default function VisitsList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sectorId, setSectorId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(getTodayInSaoPaulo);
  const [dateTo, setDateTo] = useState(getTodayInSaoPaulo);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const checkoutVisit = useCheckoutVisit();
  const cancelVisit = useCancelVisit();

  const { data: sectors } = useListSectors();
  const { data: response, isLoading, isError } = useListVisits({
    page,
    limit: 15,
    search: search || undefined,
    sectorId: sectorId !== 'all' ? parseInt(sectorId, 10) : undefined,
    status: status !== 'all' ? status as any : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const visits = response?.data || [];
  const total = response?.total || 0;
  const totalPages = Math.ceil(total / 15);

  const resetPage = () => setPage(1);

  const handleDateFromChange = (value: string) => {
    const nextDate = value || getTodayInSaoPaulo();
    setDateFrom(nextDate);
    if (nextDate > dateTo) setDateTo(nextDate);
    resetPage();
  };

  const handleDateToChange = (value: string) => {
    const nextDate = value || getTodayInSaoPaulo();
    setDateTo(nextDate);
    if (nextDate < dateFrom) setDateFrom(nextDate);
    resetPage();
  };

  const setTodayFilter = () => {
    const today = getTodayInSaoPaulo();
    setDateFrom(today);
    setDateTo(today);
    resetPage();
  };

  const handleCheckout = (id: number) => {
    if (confirm('Confirmar a saída deste visitante?')) {
      checkoutVisit.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVisitsQueryKey() });
          toast({ title: 'Saída registrada com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao registrar saída' })
      });
    }
  };

  const handleCancelSubmit = () => {
    if (cancelTarget && cancelReason) {
      cancelVisit.mutate({ id: cancelTarget, data: { reason: cancelReason } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVisitsQueryKey() });
          setCancelModalOpen(false);
          toast({ title: 'Visita cancelada' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao cancelar visita' })
      });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-primary" />
            Visitas
          </h1>
          <p className="text-gray-500 mt-1">Acompanhamento e histórico de entradas e saídas.</p>
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Buscar por visitante, CPF..." 
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                  className="pl-9 bg-white"
                />
              </div>
              <Select value={status} onValueChange={(value) => { setStatus(value); resetPage(); }}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="ongoing">Em andamento</SelectItem>
                  <SelectItem value="finished">Finalizado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="w-[200px]">
                <Select value={sectorId} onValueChange={(value) => { setSectorId(value); resetPage(); }}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Setores</SelectItem>
                    {sectors?.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input type="date" value={dateFrom} max={dateTo} onChange={e => handleDateFromChange(e.target.value)} className="w-[150px] bg-white text-sm" />
                <span className="text-gray-400">até</span>
                <Input type="date" value={dateTo} min={dateFrom} onChange={e => handleDateToChange(e.target.value)} className="w-[150px] bg-white text-sm" />
                <Button type="button" variant="outline" size="sm" onClick={setTodayFilter}>Hoje</Button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Visitante</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Data/Hora Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-red-600">Não foi possível carregar as visitas. Tente atualizar a página.</TableCell>
                  </TableRow>
                ) : visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">Nenhuma visita encontrada com os filtros atuais.</TableCell>
                  </TableRow>
                ) : (
                  visits.map((visit) => (
                    <TableRow key={visit.id} className="hover:bg-blue-50/50">
                      <TableCell className="font-mono text-xs text-gray-500">#{visit.id}</TableCell>
                      <TableCell className="font-medium">{visit.visitor?.name}</TableCell>
                      <TableCell className="text-sm">{visit.sector?.name}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDateOnly(visit.entryDate)} <span className="font-mono text-xs ml-1 text-gray-500">{visit.entryTime}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500 whitespace-nowrap">
                        {visit.exitTime ? `${formatDateOnly(visit.exitDate)} ${visit.exitTime}` : '-'}
                      </TableCell>
                      <TableCell><StatusBadge status={visit.status} /></TableCell>
                      <TableCell className="text-right whitespace-nowrap space-x-1">
                        {visit.status === 'ongoing' && (
                          <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-orange-50 h-8 px-2" onClick={() => handleCheckout(visit.id)} disabled={checkoutVisit.isPending}>
                            <CheckoutIcon className="w-3.5 h-3.5 mr-1" /> Saída
                          </Button>
                        )}
                        <Link href={`/visits/${visit.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2" title="Ver Detalhes">
                            <Eye className="w-4 h-4 text-blue-600" />
                          </Button>
                        </Link>
                        {isAdmin && visit.status === 'ongoing' && (
                          <Button variant="ghost" size="sm" className="h-8 px-2" title="Cancelar Visita" onClick={() => { setCancelTarget(visit.id); setCancelReason(''); setCancelModalOpen(true); }}>
                            <Ban className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="p-4 flex items-center justify-between border-t bg-gray-50/30">
              <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
              <div className="space-x-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Cancelar Visita
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600">Esta ação irá invalidar o registro de visita #{cancelTarget}. Por favor, informe o motivo do cancelamento.</p>
            <div className="space-y-2">
              <Label>Motivo do Cancelamento</Label>
              <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Ex: Registro duplicado, visitante não compareceu..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Desistir</Button>
            <Button variant="destructive" onClick={handleCancelSubmit} disabled={!cancelReason || cancelVisit.isPending}>Confirmar Cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
