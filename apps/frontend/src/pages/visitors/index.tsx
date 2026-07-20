import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useListVisitors } from '@visit-control/api-client';
import { Users, Search, ChevronRight, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';

export default function VisitorsList() {
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
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Users className="w-8 h-8 text-primary" />
              Visitantes
            </h1>
            <p className="text-gray-500 mt-1">Base de dados de todas as pessoas que já visitaram o município.</p>
          </div>
          <Button onClick={() => setLocation('/visitors/new')} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Cadastrar Visitante
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex gap-4">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, CPF ou empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
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
                  <TableRow key={visitor.id} className="hover:bg-blue-50/50 cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/visitors/${visitor.id}`} className="hover:underline flex items-center">
                        {visitor.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-600">{visitor.cpf || '-'}</TableCell>
                    <TableCell className="text-gray-600">{visitor.company || '-'}</TableCell>
                    <TableCell className="text-gray-600">{visitor.city || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/visitors/${visitor.id}`}>
                        <Button variant="ghost" size="sm" className="gap-1">
                          Ver Perfil <ChevronRight className="w-4 h-4" />
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
