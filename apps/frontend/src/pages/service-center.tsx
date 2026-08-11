import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Headphones, RefreshCw, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { serviceApi } from '@/lib/service-api';
import { useToast } from '@/hooks/use-toast';

const centralKey = ['service-central'];
const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function ServiceCenter() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deskId, setDeskId] = useState<string>('');
  const { data, isLoading, error } = useQuery({ queryKey: centralKey, queryFn: () => serviceApi.central(), refetchInterval: 30000 });

  useEffect(() => {
    const events = new EventSource('/api/service/display/events');
    events.addEventListener('update', () => queryClient.invalidateQueries({ queryKey: centralKey }));
    return () => events.close();
  }, [queryClient]);

  useEffect(() => {
    if (!deskId && data?.sector.usesDesks) {
      const first = data.desks.find((desk) => desk.active);
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
  const complete = useMutation({
    mutationFn: (id: number) => serviceApi.complete(id),
    onSuccess: () => { refresh(); toast({ title: 'Atendimento finalizado' }); },
    onError: (e: Error) => toast({ variant: 'destructive', title: e.message }),
  });

  if (isLoading) return <AppLayout><div className="p-8 text-muted-foreground">Carregando central...</div></AppLayout>;
  if (error || !data) return <AppLayout><div className="p-8"><Card><CardContent className="pt-6 text-destructive">{(error as Error)?.message ?? 'Central indisponível'}</CardContent></Card></div></AppLayout>;

  const activeDesks = data.desks.filter((desk) => desk.active);
  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Headphones className="h-8 w-8 text-primary" />Central de Atendimento — {data.sector.name}</h1>
          <p className="text-muted-foreground mt-1">A fila é atualizada automaticamente e segue a ordem de chegada.</p>
        </div>

        <Card>
          <CardContent className="pt-6 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Forma de atendimento</p>
              {data.sector.usesDesks ? (
                <Select value={deskId} onValueChange={setDeskId}>
                  <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecione uma mesa" /></SelectTrigger>
                  <SelectContent>{activeDesks.map((desk) => <SelectItem key={desk.id} value={String(desk.id)}>{desk.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : <div className="font-semibold">Chamada geral do setor <span className="ml-2 text-xs rounded-full bg-green-100 text-green-800 px-2 py-1">Atendimento ativo</span></div>}
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted px-5 py-3"><Users className="text-primary" /><div><strong className="text-2xl">{data.queue.length}</strong><p className="text-xs text-muted-foreground">pessoas aguardando</p></div></div>
          </CardContent>
        </Card>

        {data.current && (
          <Card className="border-primary/20">
            <CardHeader><CardTitle className="text-primary">Atendimento atual</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><div className="text-2xl font-bold">{data.current.visitorName}</div><p className="text-muted-foreground">Chamado às {time(data.current.calledAt)}{data.current.deskName ? ` — ${data.current.deskName}` : ''}</p></div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => recall.mutate(data.current!.id)} disabled={recall.isPending}><RefreshCw className="mr-2 h-4 w-4" />Chamar novamente</Button>
                <Button onClick={() => complete.mutate(data.current!.id)} disabled={complete.isPending}><CheckCircle2 className="mr-2 h-4 w-4" />Finalizar atendimento</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle>Fila de espera</CardTitle>
            <Button size="lg" onClick={() => callNext.mutate()} disabled={callNext.isPending || !!data.current || data.queue.length === 0 || (data.sector.usesDesks && !deskId)}><Bell className="mr-2 h-5 w-5" />CHAMAR PRÓXIMO</Button>
          </CardHeader>
          <CardContent>
            <Table><TableHeader><TableRow><TableHead className="w-24">Posição</TableHead><TableHead>Visitante</TableHead><TableHead className="w-32">Entrada</TableHead></TableRow></TableHeader>
              <TableBody>{data.queue.length ? data.queue.map((person, index) => <TableRow key={person.id}><TableCell className="font-semibold">{index + 1}</TableCell><TableCell>{person.visitorName}</TableCell><TableCell>{time(person.queuedAt)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Nenhum visitante aguardando.</TableCell></TableRow>}</TableBody>
            </Table>
            <p className="mt-4 text-xs text-muted-foreground flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" />Atualização automática</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
