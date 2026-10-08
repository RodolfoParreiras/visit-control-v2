import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, CheckCircle2, CircleStop, CircleUserRound, Headphones, RefreshCw, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { serviceApi, type QueuePerson, type QueueType } from '@/lib/service-api';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PriorityBadge } from '@/components/ServiceInfo';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const centralKey = ['service-central'];
const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const queueNames: Record<QueueType, string> = { priority: 'prioritária', normal: 'comum' };
const plural = (count: number) => (count === 1 ? 'pessoa aguardando' : 'pessoas aguardando');

function QueueTable({ people, showReason }: { people: QueuePerson[]; showReason?: boolean }) {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow className="bg-slate-50 hover:bg-slate-50">
          <TableHead className="w-[18%]">Posição</TableHead>
          <TableHead className="w-[60%]">Visitante</TableHead>
          <TableHead className="w-[22%]">Entrada</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.length ? people.map((person, index) => (
          <TableRow key={person.id} className="hover:bg-slate-50/80">
            <TableCell className="font-semibold text-[#012c61]">{index + 1}</TableCell>
            <TableCell className="break-words">
              <div className="font-medium">{person.visitorName}</div>
              {showReason && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <PriorityBadge level={person.priorityLevel} reason={person.priorityReason} />
                  {person.priorityReason && <span className="text-xs text-slate-500">{person.priorityReason}</span>}
                </div>
              )}
            </TableCell>
            <TableCell className="text-slate-600">{time(person.queuedAt)}</TableCell>
          </TableRow>
        )) : (
          <TableRow>
            <TableCell colSpan={3} className="py-12 text-center text-slate-500">
              <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <span>Ninguém aguardando nesta fila.</span>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default function ServiceCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deskId, setDeskId] = useState<string>('');
  const [confirmCompleteOnlyOpen, setConfirmCompleteOnlyOpen] = useState(false);
  const [completeAndNextQueue, setCompleteAndNextQueue] = useState<QueueType | null>(null);
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

  // No navegador, avisa ao fechar a aba com alguém em atendimento. O app
  // desktop tem o próprio aviso (ExitGuard), e lá o beforeunload bloquearia o F5.
  const hasCurrent = Boolean(data?.current);
  useEffect(() => {
    if (!hasCurrent || 'desktopApp' in window) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasCurrent]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: centralKey });
  const selectedDesk = () => (data?.sector.usesDesks ? Number(deskId) : null);
  const callNext = useMutation({
    mutationFn: (queue: QueueType) => serviceApi.callNext({ deskId: selectedDesk(), queue }),
    onSuccess: (_result, queue) => { refresh(); toast({ title: `Visitante da fila ${queueNames[queue]} chamado` }); },
    onError: (e: Error) => toast({ variant: 'destructive', title: e.message }),
  });
  const recall = useMutation({
    mutationFn: (id: number) => serviceApi.recall(id),
    onSuccess: () => toast({ title: 'Chamada repetida no visor' }),
    onError: (e: Error) => toast({ variant: 'destructive', title: e.message }),
  });
  const completeOnly = useMutation({
    mutationFn: (id: number) => serviceApi.complete(id),
    onSuccess: () => {
      setConfirmCompleteOnlyOpen(false);
      refresh();
      toast({
        title: 'Atendimento finalizado e saída registrada',
        description: 'Nenhum novo visitante foi chamado.',
      });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: e.message }),
  });
  const completeAndCallNext = useMutation({
    mutationFn: ({ id, queue }: { id: number; queue: QueueType }) =>
      serviceApi.completeAndCallNext(id, { deskId: selectedDesk(), queue }),
    onSuccess: (result, { queue }) => {
      setCompleteAndNextQueue(null);
      refresh();
      toast({
        title: result.calledNext
          ? `Atendimento finalizado e próximo da fila ${queueNames[queue]} chamado`
          : 'Atendimento finalizado e saída registrada',
        description: result.calledNext
          ? 'A saída foi contabilizada e a próxima pessoa já foi chamada.'
          : `A saída foi contabilizada. Não há mais ninguém na fila ${queueNames[queue]}.`,
      });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: e.message }),
  });

  if (isLoading) return <AppLayout><div className="p-8 text-muted-foreground">Carregando central...</div></AppLayout>;
  if (!data) return <AppLayout><div className="p-8"><Card><CardContent className="pt-6 text-destructive">{(error as Error)?.message ?? 'Central indisponível'}</CardContent></Card></div></AppLayout>;

  const activeDesks = data.desks.filter((desk) => desk.active);
  // A fila prioritária já vem ordenada: 80+ primeiro e, depois, por ordem de chegada.
  const priorityQueue = data.queue.filter((person) => person.priorityLevel > 0);
  const normalQueue = data.queue.filter((person) => person.priorityLevel === 0);
  const queues: Record<QueueType, QueuePerson[]> = { priority: priorityQueue, normal: normalQueue };
  const deskReady = !data.sector.usesDesks || Boolean(deskId);
  const busy = completeOnly.isPending || completeAndCallNext.isPending;

  const queueCard = (queue: QueueType) => {
    const people = queues[queue];
    const isPriority = queue === 'priority';
    return (
      <Card className={cn('overflow-hidden shadow-sm', isPriority ? 'border-amber-200' : 'border-slate-200')}>
        <CardHeader className={cn('flex-row items-center justify-between gap-4 space-y-0 border-b px-6 py-5', isPriority ? 'border-amber-100 bg-amber-50/60' : 'border-slate-100')}>
          <div>
            <CardTitle className="text-lg text-[#012c61]">{isPriority ? 'Fila prioritária' : 'Fila comum'}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{people.length} {plural(people.length)}</p>
          </div>
          {!data.current && (
            <Button
              className={cn('h-11 rounded-lg border-0 px-4 font-semibold text-white disabled:bg-slate-400', isPriority ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#012c61] hover:bg-[#01244f]')}
              onClick={() => callNext.mutate(queue)}
              disabled={callNext.isPending || !people.length || !deskReady}
            >
              <Bell className="mr-2 h-4 w-4" />{isPriority ? 'CHAMAR PRIORITÁRIO' : 'CHAMAR COMUM'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <QueueTable people={people} showReason={isPriority} />
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="page-container">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="page-title"><Headphones className="h-8 w-8" />Central de Atendimento — {data.sector.name}</h1>
            <p className="mt-1 text-slate-500">Escolha de qual fila chamar. Na fila prioritária, pessoas com 80 anos ou mais aparecem primeiro.</p>
          </div>
          <div className="hidden text-right text-sm text-slate-500 sm:block">
            <div className="flex items-center justify-end gap-2 font-semibold text-slate-600"><span>Olá, {user?.name}</span><CircleUserRound className="h-5 w-5" /></div>
            <div className="mt-2 flex items-center justify-end gap-2"><span>{format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span><CalendarDays className="h-5 w-5" /></div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Não foi possível atualizar a fila agora ({(error as Error).message}). Mostrando os últimos dados recebidos; uma nova tentativa é feita automaticamente.
          </div>
        )}

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
            <div className="flex flex-wrap gap-3">
              <div className="flex min-w-[170px] items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[#012c61]"><Users className="h-7 w-7 text-amber-600" /><div><strong className="text-3xl leading-none">{priorityQueue.length}</strong><p className="mt-1 text-sm text-slate-500">prioritários</p></div></div>
              <div className="flex min-w-[170px] items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-[#012c61]"><Users className="h-7 w-7" /><div><strong className="text-3xl leading-none">{normalQueue.length}</strong><p className="mt-1 text-sm text-slate-500">na fila comum</p></div></div>
            </div>
          </div>
        </Card>

        {data.current && (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5"><CardTitle className="text-lg text-[#012c61]">Atendimento atual</CardTitle></CardHeader>
            <CardContent className="space-y-5 p-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="break-words text-2xl font-bold text-[#012c61]">{data.current.visitorName}</span>
                  <PriorityBadge level={data.current.priorityLevel} reason={data.current.priorityReason} />
                </div>
                <p className="mt-1 text-slate-500">Chamado às {time(data.current.calledAt)}{data.current.deskName ? ` — ${data.current.deskName}` : ''}{data.current.priorityReason ? ` — ${data.current.priorityReason}` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="h-11 rounded-lg border-slate-200 px-5 text-[#012c61] hover:bg-[#174f8c]/10" onClick={() => recall.mutate(data.current!.id)} disabled={recall.isPending || busy}><RefreshCw className="mr-2 h-4 w-4" />Chamar novamente</Button>
                <Button variant="outline" className="h-11 rounded-lg border-[#012c61]/25 bg-white px-5 font-semibold text-[#012c61] hover:bg-slate-100" onClick={() => setConfirmCompleteOnlyOpen(true)} disabled={busy}><CircleStop className="mr-2 h-4 w-4" />Finalizar atendimento</Button>
                <Button className="h-11 rounded-lg border-0 bg-amber-600 px-5 font-semibold text-white hover:bg-amber-700" onClick={() => setCompleteAndNextQueue('priority')} disabled={busy || !deskReady || !priorityQueue.length}><CheckCircle2 className="mr-2 h-4 w-4" />Finalizar e chamar prioritário</Button>
                <Button className="h-11 rounded-lg border-0 bg-[#012c61] px-5 font-semibold text-white hover:bg-[#01244f]" onClick={() => setCompleteAndNextQueue('normal')} disabled={busy || !deskReady || !normalQueue.length}><CheckCircle2 className="mr-2 h-4 w-4" />Finalizar e chamar comum</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {queueCard('priority')}
          {queueCard('normal')}
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-green-500" />Atualização automática</p>

        <ConfirmDialog
          open={confirmCompleteOnlyOpen}
          onOpenChange={setConfirmCompleteOnlyOpen}
          title="Finalizar atendimento?"
          description={`O atendimento de ${data.current?.visitorName ?? 'visitante atual'} será encerrado e a saída será registrada para a recepção. Nenhum novo visitante será chamado.`}
          confirmLabel="Finalizar atendimento"
          isPending={completeOnly.isPending}
          onConfirm={() => data.current && completeOnly.mutate(data.current.id)}
        />

        <ConfirmDialog
          open={completeAndNextQueue !== null}
          onOpenChange={(open) => !open && setCompleteAndNextQueue(null)}
          title={`Finalizar e chamar da fila ${completeAndNextQueue ? queueNames[completeAndNextQueue] : ''}?`}
          description={`O atendimento de ${data.current?.visitorName ?? 'visitante atual'} será encerrado, a saída será registrada para a recepção e a próxima pessoa da fila ${completeAndNextQueue ? queueNames[completeAndNextQueue] : ''} será chamada.`}
          confirmLabel="Finalizar e chamar"
          isPending={completeAndCallNext.isPending}
          onConfirm={() => data.current && completeAndNextQueue && completeAndCallNext.mutate({ id: data.current.id, queue: completeAndNextQueue })}
        />
      </div>
    </AppLayout>
  );
}
