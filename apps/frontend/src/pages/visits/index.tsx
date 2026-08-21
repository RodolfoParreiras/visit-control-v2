import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  useListVisits, 
  useListSectors, 
  useCheckoutVisit, 
  getListVisitsQueryKey
} from '@visit-control/api-client';
import { CalendarDays, CircleUserRound, ClipboardList, Eye, LogOut as CheckoutIcon, Search, UserPlus } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { formatDateOnly } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [visitToCheckout, setVisitToCheckout] = useState<{ id: number; visitorName: string } | null>(null);
  const [search, setSearch] = useState('');
  const [sectorId, setSectorId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(getTodayInSaoPaulo);
  const [dateTo, setDateTo] = useState(getTodayInSaoPaulo);

  const checkoutVisit = useCheckoutVisit();

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

  const handleCheckout = () => {
    if (visitToCheckout) {
      checkoutVisit.mutate({ id: visitToCheckout.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVisitsQueryKey() });
          setVisitToCheckout(null);
          toast({ title: 'Saída registrada com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao registrar saída' })
      });
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#012c61]">
              <ClipboardList className="h-8 w-8" />
              Visitas
            </h1>
            <p className="mt-1 text-slate-500">Acompanhamento e histórico de entradas e saídas.</p>
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
          <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.6fr)_170px_170px_minmax(470px,2fr)] xl:gap-3">
            <div className="space-y-2">
              <Label htmlFor="visit-search" className="text-sm font-semibold text-[#012c61]">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="visit-search"
                  placeholder="Buscar visitante"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                  className="h-11 rounded-lg border-slate-300 bg-white pl-10 focus-visible:ring-[#174f8c]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#012c61]">Status</Label>
              <Select value={status} onValueChange={(value) => { setStatus(value); resetPage(); }}>
                <SelectTrigger className="h-11 rounded-lg border-slate-300 bg-white focus:ring-[#174f8c]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ongoing">Em andamento</SelectItem>
                  <SelectItem value="finished">Finalizado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#012c61]">Setor</Label>
              <Select value={sectorId} onValueChange={(value) => { setSectorId(value); resetPage(); }}>
                <SelectTrigger className="h-11 rounded-lg border-slate-300 bg-white focus:ring-[#174f8c]">
                  <SelectValue placeholder="Setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {sectors?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label className="text-sm font-semibold text-[#012c61]">Período</Label>
              <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
                <Input type="date" value={dateFrom} max={dateTo} onChange={e => handleDateFromChange(e.target.value)} className="h-11 min-w-[145px] flex-1 rounded-lg border-slate-300 bg-white text-sm focus-visible:ring-[#174f8c] xl:min-w-0" />
                <span className="shrink-0 text-sm text-slate-400">até</span>
                <Input type="date" value={dateTo} min={dateFrom} onChange={e => handleDateToChange(e.target.value)} className="h-11 min-w-[145px] flex-1 rounded-lg border-slate-300 bg-white text-sm focus-visible:ring-[#174f8c] xl:min-w-0" />
                <Button type="button" variant="outline" onClick={setTodayFilter} className="h-11 shrink-0 rounded-lg border-[#174f8c]/50 px-3 text-[#012c61] hover:bg-[#174f8c]/10">
                  <CalendarDays className="mr-2 h-4 w-4" />Hoje
                </Button>
              </div>
            </div>

          </div>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="font-semibold text-[#012c61]">Registros encontrados</h2>
              <p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'visita' : 'visitas'}</p>
            </div>
            <Link href="/visits/new">
              <Button className="h-11 gap-2 rounded-lg border-0 bg-[#012c61] px-5 font-semibold text-white hover:bg-[#01244f]">
                <UserPlus className="h-4 w-4" />Nova Visita
              </Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[5%]">ID</TableHead>
                  <TableHead className="w-[21%]">Visitante</TableHead>
                  <TableHead className="w-[12%]">Setor</TableHead>
                  <TableHead className="w-[17%]">Entrada</TableHead>
                  <TableHead className="w-[11%]">Saída</TableHead>
                  <TableHead className="w-[13%]">Status</TableHead>
                  <TableHead className="w-[21%] text-right">Ações</TableHead>
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
                    <TableRow key={visit.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono text-xs text-gray-500">#{visit.id}</TableCell>
                      <TableCell className="truncate font-medium" title={visit.visitor?.name}>{visit.visitor?.name}</TableCell>
                      <TableCell className="truncate text-sm" title={visit.sector?.name}>{visit.sector?.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                        {formatDateOnly(visit.entryDate)} <span className="ml-1">{visit.entryTime}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                        {visit.exitTime ? `${formatDateOnly(visit.exitDate)} ${visit.exitTime}` : '-'}
                      </TableCell>
                      <TableCell><StatusBadge status={visit.status} /></TableCell>
                      <TableCell className="text-right whitespace-nowrap space-x-1">
                        {visit.status === 'ongoing' && (
                          <Button variant="outline" size="sm" className="h-9 border-slate-200 px-3 text-[#012c61] hover:border-transparent hover:bg-red-600 hover:text-white" onClick={() => setVisitToCheckout({ id: visit.id, visitorName: visit.visitor?.name ?? 'este visitante' })} disabled={checkoutVisit.isPending}>
                            <CheckoutIcon className="mr-1.5 h-3.5 w-3.5" />Saída
                          </Button>
                        )}
                        <Link href={`/visits/${visit.id}`}>
                          <Button variant="outline" size="sm" className="h-9 gap-2 border-slate-200 px-3 text-[#012c61] hover:bg-[#174f8c]/10" title="Ver Detalhes">
                            <Eye className="h-4 w-4" />Detalhes
                          </Button>
                        </Link>
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
      <ConfirmDialog
        open={!!visitToCheckout}
        onOpenChange={(open) => !open && setVisitToCheckout(null)}
        title="Registrar saída?"
        description={`Confirma a saída de ${visitToCheckout?.visitorName ?? 'este visitante'}? O horário será registrado automaticamente.`}
        confirmLabel="Registrar saída"
        isPending={checkoutVisit.isPending}
        onConfirm={handleCheckout}
      />
    </AppLayout>
  );
}
