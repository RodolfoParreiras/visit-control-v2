import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  useListUsers, 
  useCreateUser, 
  useUpdateUser, 
  useDeleteUser,
  useResetUserPassword,
  User,
  getListUsersQueryKey,
  useListSectors,
  type UserPermissions,
} from '@visit-control/api-client';
import { defaultPermissionsForRole, permissionGroups } from '@/lib/permissions';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, CircleUserRound, UserCog, Plus, Edit, Trash2, Search, KeyRound } from 'lucide-react';
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

const INITIAL_PASSWORD = 'Mudar@123!';

const userSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  login: z.string().min(1, 'Login é obrigatório'),
  role: z.enum(['admin', 'receptionist', 'attendant']),
  sectorId: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'inactive']),
  permissions: z.custom<UserPermissions>((value) => typeof value === 'object' && value !== null),
}).refine(
  data => data.role === 'admin' || !data.permissions.accessServiceCenter || !!data.sectorId,
  { message: 'Informe o setor de atendimento', path: ['sectorId'] },
);

type UserFormValues = z.infer<typeof userSchema>;

// O setor é obrigatório só para quem opera a Central; nos demais é opcional e,
// quando definido, limita o que o usuário enxerga (exceto administradores).
const sectorRequired = (values: Pick<UserFormValues, 'role' | 'permissions'>) =>
  values.role !== 'admin' && Boolean(values.permissions.accessServiceCenter);

const errorMessage = (error: unknown) =>
  (error as { data?: { error?: string } } | null)?.data?.error;

export default function Users() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useListUsers();
  const { data: sectors } = useListSectors({ status: 'active' });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetUserPassword = useResetUserPassword();

  const [search, setSearch] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      login: '',
      role: 'receptionist',
      sectorId: null,
      status: 'active',
      permissions: defaultPermissionsForRole('receptionist'),
    },
  });

  const openNewDialog = () => {
    setEditingUser(null);
    form.reset({
      name: '',
      login: '',
      role: 'receptionist',
      sectorId: null,
      status: 'active',
      permissions: defaultPermissionsForRole('receptionist'),
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      login: user.login,
      role: user.role,
      sectorId: user.sectorId ?? null,
      status: user.status,
      permissions: { ...defaultPermissionsForRole(user.role), ...user.permissions },
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: UserFormValues) => {
    if (editingUser) {
      updateUser.mutate({ id: editingUser.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setIsDialogOpen(false);
          toast({ title: 'Usuário atualizado com sucesso' });
        },
        onError: (error) => toast({ variant: 'destructive', title: 'Erro ao atualizar usuário', description: errorMessage(error) })
      });
    } else {
      createUser.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setIsDialogOpen(false);
          toast({ title: 'Usuário criado com sucesso' });
        },
        onError: (error) => toast({ variant: 'destructive', title: 'Erro ao criar usuário', description: errorMessage(error) })
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

  const handleResetPassword = () => {
    if (!userToReset) return;

    resetUserPassword.mutate({ id: userToReset.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setUserToReset(null);
        toast({
          title: 'Senha resetada com sucesso',
          description: `Senha provisória: ${INITIAL_PASSWORD}`,
        });
      },
      onError: () => toast({ variant: 'destructive', title: 'Erro ao resetar senha' }),
    });
  };

  const filteredUsers = users?.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.login.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="page-container">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="page-title">
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
                <TableHead className="w-[6%]">ID</TableHead><TableHead className="w-[17%]">Nome</TableHead><TableHead className="w-[16%]">Login</TableHead><TableHead className="w-[14%]">Perfil</TableHead><TableHead className="w-[10%]">Status</TableHead><TableHead className="w-[12%]">Criado em</TableHead><TableHead className="w-[25%] text-right">Ações</TableHead>
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
                      <Button variant="outline" size="sm" className="h-9 gap-2 border-slate-200 px-3 text-[#012c61] hover:bg-[#174f8c]/10" onClick={() => setUserToReset(user)}>
                        <KeyRound className="h-4 w-4" />Resetar senha
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
              {!editingUser && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Senha inicial: <strong className="text-[#012c61]">{INITIAL_PASSWORD}</strong>. O usuário deverá alterá-la no primeiro acesso.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value: UserFormValues['role']) => {
                        field.onChange(value);
                        // O perfil sugere um conjunto inicial de permissões, que pode ser ajustado abaixo.
                        form.setValue('permissions', defaultPermissionsForRole(value));
                      }}
                    >
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
              {(() => {
                const role = form.watch('role');
                const required = sectorRequired({ role, permissions: form.watch('permissions') });
                return (
                <FormField control={form.control} name="sectorId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor{required ? '' : ' (opcional)'}</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? null : Number(value))}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {!required && <SelectItem value="none">Nenhum (todos os setores)</SelectItem>}
                        {sectors?.map((sector) => <SelectItem key={sector.id} value={String(sector.id)}>{sector.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      {role === 'admin'
                        ? 'Administradores veem todos os setores; o setor só define qual Central de Atendimento ele opera.'
                        : 'Com um setor definido, o usuário só vê visitas, visitantes, relatórios, dashboard e visor desse setor, e só registra visitas para ele.'}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
                );
              })()}
              {form.watch('role') === 'admin' ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Administradores têm acesso a todas as funções do sistema, incluindo usuários e backup.
                </div>
              ) : (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <div>
                    <h3 className="font-medium text-gray-900">Permissões do usuário</h3>
                    <p className="text-sm text-gray-500">
                      O perfil escolhido sugere as permissões iniciais. Ajuste o que este usuário poderá fazer.
                      Usuários e backup são exclusivos de administradores.
                    </p>
                  </div>
                  {permissionGroups.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.items.map((item) => (
                          <FormField key={item.key} control={form.control} name={`permissions.${item.key}`} render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-4 space-y-0 rounded-md bg-white px-3 py-2 shadow-sm">
                              <FormLabel className="m-0 font-normal">{item.label}</FormLabel>
                              <FormControl>
                                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )} />
                        ))}
                      </div>
                    </div>
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
        open={!!userToReset}
        onOpenChange={(open) => !open && setUserToReset(null)}
        title="Resetar senha?"
        description={`A senha de ${userToReset?.name ?? ''} será redefinida para ${INITIAL_PASSWORD}. O usuário deverá alterá-la no próximo acesso.`}
        confirmLabel="Resetar senha"
        isPending={resetUserPassword.isPending}
        onConfirm={handleResetPassword}
      />
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
