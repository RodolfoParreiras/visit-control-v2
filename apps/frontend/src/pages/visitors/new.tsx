import { useCallback } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { maskCpf, isValidCpf, stripCpfMask } from "@/lib/cpf";
import { useCreateVisitor, useGetFieldConfig } from "@visit-control/api-client";
import type { VisitorInput } from "@visit-control/api-client";
import { CalendarDays, CircleUserRound, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function VisitorNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: fieldConfig, isLoading: configLoading } = useGetFieldConfig();
  const createVisitor = useCreateVisitor();

  const createSchema = () => {
    const s: Record<string, z.ZodTypeAny> = {
      name: z.string().min(1, "Nome é obrigatório"),
      cpf: z
        .string()
        .min(1, "CPF é obrigatório")
        .refine(isValidCpf, "CPF inválido."),
      phone: z.string().optional(),
      company: z.string().optional(),
      city: z.string().optional(),
    };

    if (!fieldConfig) return z.object(s);

    const mapRules = (field: string) => {
      const status = fieldConfig[field as keyof typeof fieldConfig];
      if (status === "required") return z.string().min(1, "Campo obrigatório");
      return z.string().optional();
    };

    s.phone = mapRules("phone");
    s.company = mapRules("company");
    s.city = mapRules("city");

    return z.object(s);
  };

  const form = useForm({
    resolver: zodResolver(createSchema()),
    defaultValues: { name: "", cpf: "", phone: "", company: "", city: "" },
  });

  const handleCpfChange = useCallback(
    (onChange: (v: string) => void) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(maskCpf(e.target.value));
      },
    [],
  );

  const onSubmit = (data: any) => {
    const payload: VisitorInput = {
      name: data.name,
      cpf: stripCpfMask(data.cpf),
    };
    if (data.phone) payload.phone = data.phone;
    if (data.company) payload.company = data.company;
    if (data.city) payload.city = data.city;

    createVisitor.mutate(
      { data: payload },
      {
        onSuccess: (visitor) => {
          toast({ title: "Visitante cadastrado com sucesso." });
          setLocation(`/visits/new?visitorId=${visitor.id}`);
        },
        onError: (err: any) => {
          const msg = err.response?.data?.error;
          if (err.response?.status === 409) {
            form.setError("cpf", { message: "Este CPF já está cadastrado." });
          } else {
            toast({
              variant: "destructive",
              title: "Erro ao cadastrar visitante",
              description: msg,
            });
          }
        },
      },
    );
  };

  if (configLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">
          Carregando formulário...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#012c61]">
              <UserPlus className="h-8 w-8" />
              Cadastrar Visitante
            </h1>
            <p className="mt-1 text-slate-500">Preencha os dados do novo visitante.</p>
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

        <Card className="max-w-5xl overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
            <CardTitle className="text-lg text-[#012c61]">Dados do Visitante</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input
                            autoFocus
                            {...field}
                            placeholder="Nome completo do visitante"
                            className="h-11 rounded-lg border-slate-300 focus-visible:ring-[#174f8c]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="000.000.000-00"
                            maxLength={14}
                            onChange={handleCpfChange(field.onChange)}
                            className="h-11 rounded-lg border-slate-300 focus-visible:ring-[#174f8c]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {fieldConfig?.phone !== "hidden" && (
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Telefone {fieldConfig?.phone === "required" && "*"}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} className="h-11 rounded-lg border-slate-300 focus-visible:ring-[#174f8c]" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {fieldConfig?.company !== "hidden" && (
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Empresa/Órgão{" "}
                            {fieldConfig?.company === "required" && "*"}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} className="h-11 rounded-lg border-slate-300 focus-visible:ring-[#174f8c]" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {fieldConfig?.city !== "hidden" && (
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Cidade {fieldConfig?.city === "required" && "*"}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} className="h-11 rounded-lg border-slate-300 focus-visible:ring-[#174f8c]" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/visits/new")}
                    className="h-11 rounded-lg border-slate-300 px-6"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createVisitor.isPending}
                    className="h-11 w-full rounded-lg border-0 bg-[#012c61] px-6 font-semibold text-white hover:bg-[#01244f] sm:w-48"
                  >
                    {createVisitor.isPending
                      ? "Salvando..."
                      : "Salvar Visitante"}
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
