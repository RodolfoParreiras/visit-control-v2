import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, CheckCircle2, CircleUserRound, Headphones, RefreshCw, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { serviceApi } from '@/lib/service-api';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const centralKey = ['service-central'];
const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function ServiceCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deskId, setDeskId] = useState<string>('');
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: centralKey, queryFn: () => serviceApi.central(), refetchInterval: 30000 });

  useEffect(() => {
    if (!deskId && data?.sector.usesDesks) {
      const preferred = data.current?.deskId
        ? data.desks.find((desk) => desk.id === data.current?.deskId && desk.active)
        : undefined;
      const first = preferred ?? data.desks.find((desk) => desk.active);
      if (first) setDeskId(String(first.id));
    }
  }, [data, deskId]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: centralKey });
  const callNext = useMutation({
    mutationFn: () => serviceApi.callNext({ deskId: data?.sector.usesDesks ? Number(deskId) : null }),
    onSuccess: () => { refresh(); toast({ title: 'Visitante chamado com sucesso' }); },
    onError: (e: Error) => toast({ variant: 'destructive', title: e.message }),
  });
  const recall = useMutation({
    mutationFn: (id: number) => serviceApi.recall(id),
    onSuccess: () => toast({ title: 'Chamada repetida no visor' }),
    onError: (e: Error) => toast({ variant: 'destructive', title: e.message }),
  });
  const completeAndCallNext = useMutation({
    mutationFn: (id: number) => serviceApi.completeAndCallNext(id, {
      deskId: data?.sector.usesDesks ? Number(deskId) : null,
    }),
    onSuccess: (result) => {
      setConfirmCompleteOpen(false);
      refresh();
      toast({
        title: result.calledNext
          ? 'Atendimento finalizado e próximo visitante chamado'
          : 'Atendimento finalizado e saída registrada',
        description: result.calledNext
          ? 'A saída foi contabilizada e a próxima pessoa já foi chamada.'
          : 'A saída foi contabilizada. Não há outras pessoas aguardando.',
      });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: e.message }),
  });

  if (isLoading) return <AppLayout><div className="p-8 text-muted-foreground">Carregando central...</div></AppLayout>;
  if (error || !data) return <AppLayout><div className="p-8"><Card><CardContent className="pt-6 text-destructive">{(error as Error)?.message ?? 'Central indisponível'}</CardContent></Card></div></AppLayout>;

  const activeDesks = data.desks.filter((desk) => desk.active);
  const canCallNext = !data.current
    && data.queue.length > 0
    && (!data.sector.usesDesks || Boolean(deskId));
  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#012c61]"><Headphones className="h-8 w-8" />Central de Atendimento — {data.sector.name}</h1>
            <p className="mt-1 text-slate-500">A fila é atualizada automaticamente e segue a ordem de chegada.</p>
          </div>
          <div className="hidden text-right text-sm text-slate-500 sm:block">
            <div className="flex items-center justify-end gap-2 font-semibold text-slate-600"><span>Olá, {user?.name}</span><CircleUserRound className="h-5 w-5" /></div>
            <div className="mt-2 flex items-center justify-end gap-2"><span>{format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span><CalendarDays className="h-5 w-5" /></div>
          </div>
        </div>

        <Card className="border-slate-200 p-5 shadow-sm sm:p-6">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="max-w-md space-y-2.5">
              <Label className="text-lg font-semibold leading-none tracking-tight text-[#012c61]">Forma de atendimento</Label>
              {data.sector.usesDesks ? (
                <Select value={deskId} onValueChange={setDeskId}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-300 bg-white shadow-sm focus:border-[#174f8c] focus:ring-[#174f8c]"><SelectValue placeholder="Selecione uma mesa" /></SelectTrigger>
                  <SelectContent>{activeDesks.map((desk) => <SelectItem key={desk.id} value={String(desk.id)}>{desk.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : <div className="flex h-11 items-center font-semibold text-[#012c61]">Chamada geral do setor <span className="ml-2 rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-800">Atendimento ativo</span></div>}
            </div>
            <div className="flex min-w-[195px] items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-6 py-4 text-[#012c61]"><Users className="h-7 w-7" /><div><strong className="text-3xl leading-none">{data.queue.length}</strong><p className="mt-1 text-sm text-slate-500">pessoas aguardando</p></div></div>
          </div>
        </Card>

        {data.current && (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5"><CardTitle className="text-lg text-[#012c61]">Atendimento atual</CardTitle></CardHeader>
            <CardContent className="space-y-5 p-6">
              <div><div className="break-words text-2xl font-bold text-[#012c61]">{data.current.visitorName}</div><p className="mt-1 text-slate-500">Chamado às {time(data.current.calledAt)}{data.current.deskName ? ` — ${data.current.deskName}` : ''}</p></div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="h-11 rounded-lg border-slate-200 px-5 text-[#012c61] hover:bg-[#174f8c]/10" onClick={() => recall.mutate(data.current!.id)} disabled={recall.isPending}><RefreshCw className="mr-2 h-4 w-4" />Chamar novamente</Button>
                <Button className="h-11 rounded-lg border-0 bg-[#012c61] px-5 font-semibold text-white hover:bg-[#01244f]" onClick={() => setConfirmCompleteOpen(true)} disabled={completeAndCallNext.isPending || (data.sector.usesDesks && !deskId)}><CheckCircle2 className="mr-2 h-4 w-4" />Finalizar e chamar próximo</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div><CardTitle className="text-lg text-[#012c61]">Fila de espera</CardTitle><p className="mt-1 text-sm text-slate-500">{data.queue.length} {data.queue.length === 1 ? 'pessoa aguardando' : 'pessoas aguardando'}</p></div>
            {canCallNext && (
              <Button size="lg" className="h-11 rounded-lg border-0 bg-[#012c61] px-5 font-semibold text-white hover:bg-[#01244f] disabled:bg-slate-400" onClick={() => callNext.mutate()} disabled={callNext.isPending}><Bell className="mr-2 h-5 w-5" />CHAMAR PRÓXIMO</Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table className="table-fixed"><TableHeader><TableRow className="bg-slate-50 hover:bg-slate-50"><TableHead className="w-[15%]">Posição</TableHead><TableHead className="w-[65%]">Visitante</TableHead><TableHead className="w-[20%]">Entrada</TableHead></TableRow></TableHeader>
              <TableBody>{data.queue.length ? data.queue.map((person, index) => <TableRow key={person.id} className="hover:bg-slate-50/80"><TableCell className="font-semibold text-[#012c61]">{index + 1}</TableCell><TableCell className="break-words font-medium">{person.visitorName}</TableCell><TableCell className="text-slate-600">{time(person.queuedAt)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="py-14 text-center text-slate-500"><Users className="mx-auto mb-3 h-9 w-9 text-slate-300" /><span>Nenhum visitante aguardando.</span></TableCell></TableRow>}</TableBody>
            </Table>
            <p className="flex items-center gap-2 border-t border-slate-100 px-6 py-4 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-green-500" />Atualização automática</p>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={confirmCompleteOpen}
          onOpenChange={setConfirmCompleteOpen}
          title="Finalizar atendimento e chamar o próximo?"
          description={`O atendimento de ${data.current?.visitorName ?? 'visitante atual'} será encerrado, a saída será registrada para a recepção e a próxima pessoa da fila será chamada automaticamente.`}
          confirmLabel="Finalizar e chamar"
          isPending={completeAndCallNext.isPending}
          onConfirm={() => data.current && completeAndCallNext.mutate(data.current.id)}
        />
      </div>
    </AppLayout>
  );
}
