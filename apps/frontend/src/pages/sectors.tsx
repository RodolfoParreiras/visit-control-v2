import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  useListSectors, 
  useCreateSector, 
  useUpdateSector, 
  useDeleteSector,
  Sector,
  SectorInputStatus,
  getListSectorsQueryKey
} from '@visit-control/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Building2, CalendarDays, CircleUserRound, Plus, Edit, Trash2, MonitorCog, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Switch } from '@/components/ui/switch';
import { serviceApi } from '@/lib/service-api';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const sectorSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  abbreviation: z.string().min(1, 'Sigla é obrigatória'),
  secretariat: z.string().min(1, 'Secretaria é obrigatória'),
  status: z.enum(['active', 'inactive']),
  queueEnabled: z.boolean(),
  usesDesks: z.boolean(),
});

type SectorFormValues = z.infer<typeof sectorSchema>;

export default function Sectors() {
  const { user } = useAuth();
  const { data: sectors, isLoading } = useListSectors();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createSector = useCreateSector();
  const updateSector = useUpdateSector();
  const deleteSector = useDeleteSector();

  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [deskSector, setDeskSector] = useState<Sector | null>(null);
  const [deskName, setDeskName] = useState('');
  const { data: desks } = useQuery({ queryKey: ['service-desks', deskSector?.id], queryFn: () => serviceApi.desks(deskSector!.id), enabled: !!deskSector });
  const refreshDesks = () => queryClient.invalidateQueries({ queryKey: ['service-desks', deskSector?.id] });
  const createDesk = useMutation({ mutationFn: () => serviceApi.createDesk(deskSector!.id, { name: deskName }), onSuccess: () => { setDeskName(''); refreshDesks(); toast({ title: 'Mesa adicionada' }); }, onError: (e: Error) => toast({ variant: 'destructive', title: e.message }) });

  const form = useForm<SectorFormValues>({
    resolver: zodResolver(sectorSchema),
    defaultValues: {
      name: '',
      abbreviation: '',
      secretariat: '',
      status: 'active',
      queueEnabled: false,
      usesDesks: false,
    },
  });

  const openNewDialog = () => {
    setEditingSector(null);
    form.reset({
      name: '',
      abbreviation: '',
      secretariat: '',
      status: 'active',
      queueEnabled: false,
      usesDesks: false,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (sector: Sector) => {
    setEditingSector(sector);
    form.reset({
      name: sector.name,
      abbreviation: sector.abbreviation,
      secretariat: sector.secretariat,
      status: sector.status,
      queueEnabled: sector.queueEnabled,
      usesDesks: sector.usesDesks,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: SectorFormValues) => {
    if (editingSector) {
      updateSector.mutate({ id: editingSector.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSectorsQueryKey() });
          setIsDialogOpen(false);
          toast({ title: 'Setor atualizado com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar setor' })
      });
    } else {
      createSector.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSectorsQueryKey() });
          setIsDialogOpen(false);
          toast({ title: 'Setor criado com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao criar setor' })
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este setor?')) {
      deleteSector.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSectorsQueryKey() });
          toast({ title: 'Setor excluído com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao excluir setor' })
      });
    }
  };

  const filteredSectors = sectors?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.abbreviation.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#012c61]">
              <Building2 className="h-8 w-8" />
              Setores
            </h1>
            <p className="mt-1 text-slate-500">Gerencie os setores e departamentos do município.</p>
          </div>
          <div className="hidden text-right text-sm text-slate-500 sm:block">
            <div className="flex items-center justify-end gap-2 font-semibold text-slate-600"><span>Olá, {user?.name}</span><CircleUserRound className="h-5 w-5" /></div>
            <div className="mt-2 flex items-center justify-end gap-2"><span>{format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span><CalendarDays className="h-5 w-5" /></div>
          </div>
        </div>

        <Card className="border-slate-200 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-2xl space-y-2">
              <Label htmlFor="sector-search" className="text-sm font-semibold text-[#012c61]">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="sector-search" placeholder="Buscar setor ou sigla" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 rounded-lg border-slate-300 bg-white pl-10 focus-visible:ring-[#174f8c]" />
              </div>
            </div>
            <Button onClick={openNewDialog} className="h-11 shrink-0 gap-2 rounded-lg border-0 bg-[#012c61] px-5 font-semibold text-white hover:bg-[#01244f]">
              <Plus className="h-4 w-4" />Novo Setor
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-semibold text-[#012c61]">Setores cadastrados</h2>
            <p className="mt-1 text-sm text-slate-500">{filteredSectors?.length || 0} {(filteredSectors?.length || 0) === 1 ? 'setor' : 'setores'}</p>
          </div>
          <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-[7%]">ID</TableHead><TableHead className="w-[13%]">Nome</TableHead><TableHead className="w-[9%]">Sigla</TableHead><TableHead className="w-[27%]">Secretaria</TableHead><TableHead className="w-[14%]">Atendimento</TableHead><TableHead className="w-[10%]">Status</TableHead><TableHead className="w-[20%] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                </TableRow>
              ) : filteredSectors?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">Nenhum setor encontrado.</TableCell>
                </TableRow>
              ) : (
                filteredSectors?.map((sector) => (
                  <TableRow key={sector.id} className="hover:bg-slate-50/80">
                    <TableCell className="text-xs text-slate-500">#{sector.id}</TableCell>
                    <TableCell className="truncate font-medium" title={sector.name}>{sector.name}</TableCell>
                    <TableCell>{sector.abbreviation}</TableCell>
                    <TableCell className="truncate text-sm text-slate-600" title={sector.secretariat}>{sector.secretariat}</TableCell>
                    <TableCell>{sector.queueEnabled ? <span className="text-xs font-medium rounded-full bg-blue-100 text-blue-800 px-2.5 py-1">{sector.usesDesks ? 'Com mesas' : 'Chamada geral'}</span> : <span className="text-xs text-gray-400">Desativado</span>}</TableCell>
                    <TableCell><StatusBadge active={sector.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-right space-x-1">
                      {sector.queueEnabled && sector.usesDesks && <Button variant="outline" size="sm" className="h-9 gap-2 border-slate-200 px-3 text-[#012c61] hover:bg-[#174f8c]/10" onClick={() => setDeskSector(sector)}><MonitorCog className="h-4 w-4" />Mesas</Button>}
                      <Button variant="outline" size="sm" className="h-9 gap-2 border-slate-200 px-3 text-[#012c61] hover:bg-[#174f8c]/10" onClick={() => openEditDialog(sector)}>
                        <Edit className="h-4 w-4" />Editar
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir setor" onClick={() => handleDelete(sector.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSector ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Setor</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: Recursos Humanos" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="abbreviation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sigla</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: RH" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="secretariat" render={({ field }) => (
                <FormItem>
                  <FormLabel>Secretaria Vinculada</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: Secretaria de Administração" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="queueEnabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4"><div><FormLabel>Ativar fila e central de atendimento</FormLabel><p className="text-sm text-muted-foreground">Visitas destinadas ao setor entrarão automaticamente na fila.</p></div><FormControl><Switch checked={field.value} onCheckedChange={(checked) => { field.onChange(checked); if (!checked) form.setValue('usesDesks', false); }} /></FormControl></FormItem>
              )} />
              {form.watch('queueEnabled') && <FormField control={form.control} name="usesDesks" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4"><div><FormLabel>Utilizar mesas de atendimento</FormLabel><p className="text-sm text-muted-foreground">Desative para chamadas gerais do setor.</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
              )} />}
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createSector.isPending || updateSector.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deskSector} onOpenChange={(open) => !open && setDeskSector(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mesas — {deskSector?.name}</DialogTitle></DialogHeader>
          <div className="flex gap-2"><Input value={deskName} onChange={(e) => setDeskName(e.target.value)} placeholder="Ex: Mesa 01" /><Button onClick={() => createDesk.mutate()} disabled={!deskName.trim() || createDesk.isPending}><Plus className="w-4 h-4 mr-2" />Adicionar</Button></div>
          <div className="space-y-2 max-h-80 overflow-y-auto">{desks?.map((desk) => <div key={desk.id} className="flex items-center justify-between rounded-lg border p-3"><span className={desk.active ? 'font-medium' : 'text-muted-foreground line-through'}>{desk.name}</span><div className="flex items-center gap-2"><Switch checked={desk.active} onCheckedChange={async (active) => { await serviceApi.updateDesk(deskSector!.id, desk.id, { active }); refreshDesks(); }} /><Button variant="ghost" size="icon" onClick={async () => { if (confirm('Excluir esta mesa?')) { await serviceApi.deleteDesk(deskSector!.id, desk.id); refreshDesks(); } }}><Trash2 className="w-4 h-4 text-red-600" /></Button></div></div>)}</div>
          <DialogFooter><Button variant="outline" onClick={() => setDeskSector(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
