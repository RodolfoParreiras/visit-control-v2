import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useListVisitors } from '@visit-control/api-client';
import { CalendarDays, CircleUserRound, Eye, Search, UserPlus, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/permissions';
import { maskCpf } from '@/lib/cpf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function VisitorsList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: response, isLoading } = useListVisitors({
    page,
    limit: 15,
    search: debouncedSearch || undefined,
  });

  const visitors = response?.data || [];
  const total = response?.total || 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <AppLayout>
      <div className="page-container">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="page-title">
              <Users className="h-8 w-8" />
              Visitantes
            </h1>
            <p className="mt-1 text-slate-500">Base de dados de todas as pessoas que já visitaram o município.</p>
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full space-y-2 sm:max-w-2xl">
              <Label htmlFor="visitor-search" className="text-sm font-semibold text-[#012c61]">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="visitor-search" placeholder="Buscar visitante" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 rounded-lg border-slate-300 bg-white pl-10 focus-visible:ring-[#174f8c]" />
              </div>
            </div>
            {can(user, 'createVisitor') && (
              <Button type="button" onClick={() => setLocation('/visitors/new')} className="h-11 shrink-0 gap-2 rounded-lg border-0 bg-[#012c61] px-5 font-semibold text-white hover:bg-[#01244f]">
                <UserPlus className="h-4 w-4" />Cadastrar Visitante
              </Button>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <h2 className="font-semibold text-[#012c61]">Visitantes cadastrados</h2>
            <span className="text-sm text-slate-500">{total} {total === 1 ? 'visitante' : 'visitantes'}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                </TableRow>
              ) : visitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">Nenhum visitante encontrado.</TableCell>
                </TableRow>
              ) : (
                visitors.map((visitor) => (
                  <TableRow key={visitor.id} className="hover:bg-slate-50/80">
                    <TableCell className="font-medium">{visitor.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">{visitor.cpf ? maskCpf(visitor.cpf) : '-'}</TableCell>
                    <TableCell className="text-gray-600">{visitor.company || '-'}</TableCell>
                    <TableCell className="text-gray-600">{visitor.city || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/visitors/${visitor.id}`}>
                        <Button variant="outline" size="sm" className="h-9 gap-2 border-slate-200 px-3 text-[#012c61] hover:bg-[#174f8c]/10">
                          <Eye className="h-4 w-4" />Ver perfil
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

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
    </AppLayout>
  );
}
