import { useCallback } from 'react';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { maskCpf, isValidCpf, stripCpfMask } from '@/lib/cpf';
import { useCreateVisitor, useGetFieldConfig } from '@visit-control/api-client';
import type { VisitorInput } from '@visit-control/api-client';
import { UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

export default function VisitorNew() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: fieldConfig, isLoading: configLoading } = useGetFieldConfig();
  const createVisitor = useCreateVisitor();

  const createSchema = () => {
    const s: Record<string, z.ZodTypeAny> = {
      name: z.string().min(1, 'Nome é obrigatório'),
      cpf: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      city: z.string().optional(),
    };

    if (!fieldConfig) return z.object(s);

    const cpfStatus = fieldConfig['cpf' as keyof typeof fieldConfig];
    if (cpfStatus === 'required') {
      s.cpf = z.string().min(1, 'CPF é obrigatório').refine(isValidCpf, 'CPF inválido.');
    } else {
      s.cpf = z.string().optional().refine((v) => !v || isValidCpf(v), 'CPF inválido.');
    }

    const mapRules = (field: string) => {
      const status = fieldConfig[field as keyof typeof fieldConfig];
      if (status === 'required') return z.string().min(1, 'Campo obrigatório');
      return z.string().optional();
    };

    s.phone = mapRules('phone');
    s.company = mapRules('company');
    s.city = mapRules('city');

    return z.object(s);
  };

  const form = useForm({
    resolver: zodResolver(createSchema()),
    defaultValues: { name: '', cpf: '', phone: '', company: '', city: '' },
  });

  const handleCpfChange = useCallback(
    (onChange: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(maskCpf(e.target.value));
    },
    [],
  );

  const onSubmit = (data: any) => {
    const payload: VisitorInput = { name: data.name };
    if (data.cpf) payload.cpf = stripCpfMask(data.cpf);
    if (data.phone) payload.phone = data.phone;
    if (data.company) payload.company = data.company;
    if (data.city) payload.city = data.city;

    createVisitor.mutate({ data: payload }, {
      onSuccess: (visitor) => {
        toast({ title: 'Visitante cadastrado com sucesso.' });
        setLocation(`/visits/new?visitorId=${visitor.id}`);
      },
      onError: (err: any) => {
        const msg = err.response?.data?.error;
        if (err.response?.status === 409) {
          form.setError('cpf', { message: 'Este CPF já está cadastrado.' });
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro ao cadastrar visitante',
            description: msg,
          });
        }
      },
    });
  };

  if (configLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Carregando formulário...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <UserPlus className="w-8 h-8 text-primary" />
            Cadastrar Visitante
          </h1>
          <p className="text-gray-500 mt-1">Preencha os dados do novo visitante.</p>
        </div>

        <Card>
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-3 pt-4 px-6">
            <CardTitle className="text-base">Dados do Visitante</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input autoFocus {...field} placeholder="Nome completo do visitante" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {fieldConfig?.cpf !== 'hidden' && (
                    <FormField control={form.control} name="cpf" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF {fieldConfig?.cpf === 'required' && '*'}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="000.000.000-00"
                            maxLength={14}
                            onChange={handleCpfChange(field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {fieldConfig?.phone !== 'hidden' && (
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone {fieldConfig?.phone === 'required' && '*'}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {fieldConfig?.company !== 'hidden' && (
                    <FormField control={form.control} name="company" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa/Órgão {fieldConfig?.company === 'required' && '*'}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {fieldConfig?.city !== 'hidden' && (
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade {fieldConfig?.city === 'required' && '*'}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/visits/new')}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createVisitor.isPending} className="w-44">
                    {createVisitor.isPending ? 'Salvando...' : 'Salvar Visitante'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
