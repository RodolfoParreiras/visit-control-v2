import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  useListUsers, 
  useCreateUser, 
  useUpdateUser, 
  useDeleteUser,
  User,
  getListUsersQueryKey,
  useListSectors
} from '@visit-control/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, CircleUserRound, UserCog, Plus, Edit, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const defaultVisitorPermissions = {
  editVisitorName: true,
  editVisitorCpf: true,
  editVisitorPhone: true,
  editVisitorCompany: true,
  editVisitorCity: true,
};

const userSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  login: z.string().min(1, 'Login é obrigatório'),
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.length >= 8, 'A senha deve ter pelo menos 8 caracteres'),
  role: z.enum(['admin', 'receptionist', 'attendant']),
  sectorId: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'inactive']),
  permissions: z.object({
    editVisitorName: z.boolean(),
    editVisitorCpf: z.boolean(),
    editVisitorPhone: z.boolean(),
    editVisitorCompany: z.boolean(),
    editVisitorCity: z.boolean(),
  }),
}).refine(data => data.role !== 'attendant' || !!data.sectorId, { message: 'Setor é obrigatório para atendentes', path: ['sectorId'] });

type UserFormValues = z.infer<typeof userSchema>;

export default function Users() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useListUsers();
  const { data: sectors } = useListSectors({ status: 'active' });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [search, setSearch] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      login: '',
      password: '',
      role: 'receptionist',
      sectorId: null,
      status: 'active',
      permissions: defaultVisitorPermissions,
    },
  });

  const openNewDialog = () => {
    setEditingUser(null);
    form.reset({
      name: '',
      login: '',
      password: '',
      role: 'receptionist',
      sectorId: null,
      status: 'active',
      permissions: defaultVisitorPermissions,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      login: user.login,
      password: '', // Não preencher a senha na edição
      role: user.role,
      sectorId: user.sectorId ?? null,
      status: user.status,
      permissions: { ...defaultVisitorPermissions, ...user.permissions },
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: UserFormValues) => {
    if (data.role !== 'attendant') data.sectorId = null;
    if (editingUser) {
      // Remover a senha do payload se estiver em branco na edição
      const updateData = { ...data };
      if (!updateData.password) delete updateData.password;
      
      updateUser.mutate({ id: editingUser.id, data: updateData }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setIsDialogOpen(false);
          toast({ title: 'Usuário atualizado com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar usuário' })
      });
    } else {
      if (!data.password) {
        form.setError('password', { message: 'Senha é obrigatória para novos usuários' });
        return;
      }
      // O cast abaixo é seguro pois verificamos a senha acima
      createUser.mutate({ data: data as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setIsDialogOpen(false);
          toast({ title: 'Usuário criado com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao criar usuário' })
      });
    }
  };

  const handleDelete = () => {
    if (userToDelete) {
      deleteUser.mutate({ id: userToDelete.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setUserToDelete(null);
          toast({ title: 'Usuário excluído com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao excluir usuário' })
      });
    }
  };

  const filteredUsers = users?.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.login.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#012c61]">
              <UserCog className="h-8 w-8" />
              Usuários
            </h1>
            <p className="mt-1 text-slate-500">Gerencie os acessos ao sistema.</p>
          </div>
          <div className="hidden text-right text-sm text-slate-500 sm:block">
            <div className="flex items-center justify-end gap-2 font-semibold text-slate-600"><span>Olá, {currentUser?.name}</span><CircleUserRound className="h-5 w-5" /></div>
            <div className="mt-2 flex items-center justify-end gap-2"><span>{format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span><CalendarDays className="h-5 w-5" /></div>
          </div>
        </div>

        <Card className="border-slate-200 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-2xl space-y-2">
              <Label htmlFor="user-search" className="text-sm font-semibold text-[#012c61]">Pesquisar</Label>
              <div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="user-search" placeholder="Buscar por nome ou login" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 rounded-lg border-slate-300 bg-white pl-10 focus-visible:ring-[#174f8c]" /></div>
            </div>
            <Button onClick={openNewDialog} className="h-11 shrink-0 gap-2 rounded-lg border-0 bg-[#012c61] px-5 font-semibold text-white hover:bg-[#01244f]"><Plus className="h-4 w-4" />Novo Usuário</Button>
          </div>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5"><h2 className="font-semibold text-[#012c61]">Usuários cadastrados</h2><p className="mt-1 text-sm text-slate-500">{filteredUsers?.length || 0} {(filteredUsers?.length || 0) === 1 ? 'usuário' : 'usuários'}</p></div>
          <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-[7%]">ID</TableHead><TableHead className="w-[18%]">Nome</TableHead><TableHead className="w-[20%]">Login</TableHead><TableHead className="w-[17%]">Perfil</TableHead><TableHead className="w-[12%]">Status</TableHead><TableHead className="w-[14%]">Criado em</TableHead><TableHead className="w-[12%] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                </TableRow>
              ) : filteredUsers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">Nenhum usuário encontrado.</TableCell>
                </TableRow>
              ) : (
                filteredUsers?.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/80">
                    <TableCell className="text-xs text-slate-500">#{user.id}</TableCell>
                    <TableCell className="truncate font-medium" title={user.name}>{user.name}</TableCell>
                    <TableCell className="truncate" title={user.login}>{user.login}</TableCell>
                    <TableCell><StatusBadge role={user.role} /></TableCell>
                    <TableCell><StatusBadge active={user.status} /></TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {format(new Date(user.createdAt), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right space-x-1">
                      <Button variant="outline" size="sm" className="h-9 gap-2 border-slate-200 px-3 text-[#012c61] hover:bg-[#174f8c]/10" onClick={() => openEditDialog(user)}>
                        <Edit className="h-4 w-4" />Editar
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir usuário" onClick={() => setUserToDelete(user)}>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: João da Silva" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="login" render={({ field }) => (
                <FormItem>
                  <FormLabel>Login</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: joao.silva" autoCapitalize="none" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha {editingUser && <span className="text-gray-400 font-normal">(deixe em branco para manter a atual)</span>}</FormLabel>
                  <FormControl><Input {...field} type="password" placeholder="***" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="receptionist">Recepcionista</SelectItem>
                        <SelectItem value="attendant">Atendente</SelectItem>
                      </SelectContent>
                    </Select>
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
              </div>
              {form.watch('role') === 'attendant' && (
                <FormField control={form.control} name="sectorId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor de atendimento</FormLabel>
                    <Select value={field.value ? String(field.value) : ''} onValueChange={(value) => field.onChange(Number(value))}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger></FormControl>
                      <SelectContent>{sectors?.filter((sector) => sector.queueEnabled).map((sector) => <SelectItem key={sector.id} value={String(sector.id)}>{sector.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {form.watch('role') === 'receptionist' && (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <div>
                    <h3 className="font-medium text-gray-900">Permissões de edição do visitante</h3>
                    <p className="text-sm text-gray-500">Escolha quais informações este recepcionista poderá alterar.</p>
                  </div>
                  {([
                    ['permissions.editVisitorName', 'Nome completo'],
                    ['permissions.editVisitorCpf', 'CPF'],
                    ['permissions.editVisitorPhone', 'Telefone'],
                    ['permissions.editVisitorCompany', 'Empresa/Órgão'],
                    ['permissions.editVisitorCity', 'Cidade'],
                  ] as const).map(([name, label]) => (
                    <FormField key={name} control={form.control} name={name} render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4 rounded-md bg-white px-3 py-2 shadow-sm">
                        <FormLabel className="m-0 font-normal">{label}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
              )}
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        title="Excluir usuário?"
        description={`O acesso de ${userToDelete?.name ?? ''} será removido permanentemente. Esta ação não poderá ser desfeita.`}
        confirmLabel="Excluir usuário"
        destructive
        isPending={deleteUser.isPending}
        onConfirm={handleDelete}
      />
    </AppLayout>
  );
}
