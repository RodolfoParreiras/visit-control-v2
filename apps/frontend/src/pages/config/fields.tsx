import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useGetFieldConfig,
  useUpdateFieldConfig,
  FieldConfig as ApiFieldConfig,
  getGetFieldConfigQueryKey,
} from "@visit-control/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, CircleUserRound, Save, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fieldStatus = z.enum(["hidden", "optional", "required"]);

const configSchema = z.object({
  cpf: z.literal("required"),
  phone: fieldStatus,
  company: fieldStatus,
  city: fieldStatus,
  responsible: fieldStatus,
  reason: fieldStatus,
  notes: fieldStatus,
});

type ConfigFormValues = z.infer<typeof configSchema>;

export default function ConfigFields() {
  const { user } = useAuth();
  const { data: config, isLoading } = useGetFieldConfig();
  const updateConfig = useUpdateFieldConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      cpf: "required",
      phone: "optional",
      company: "optional",
      city: "optional",
      responsible: "optional",
      reason: "optional",
      notes: "optional",
    },
  });

  useEffect(() => {
    if (config) {
      form.reset(config);
    }
  }, [config, form]);

  const onSubmit = (data: ConfigFormValues) => {
    updateConfig.mutate(
      { data: data as ApiFieldConfig },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetFieldConfigQueryKey(),
          });
          toast({ title: "Configurações salvas com sucesso" });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Erro ao salvar configurações",
          }),
      },
    );
  };

  const FieldRow = ({
    name,
    label,
    description,
  }: {
    name: keyof ConfigFormValues;
    label: string;
    description: string;
  }) => (
    <div className="flex flex-col justify-between gap-4 border-b border-slate-100 py-5 last:border-0 md:flex-row md:items-center">
      <div className="flex-1">
        <h4 className="font-semibold text-[#012c61]">{label}</h4>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>

      {name === "cpf" ? (
        <span className="rounded-full border border-[#174f8c] px-3 py-1 text-sm font-semibold text-[#012c61]">Obrigatório</span>
      ) : (
        <FormField
          control={form.control}
          name={name}
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-wrap items-center gap-x-7 gap-y-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hidden" id={`${name}-hidden`} />
                    <Label
                      htmlFor={`${name}-hidden`}
                      className="font-normal cursor-pointer text-gray-600"
                    >
                      Oculto
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="optional" id={`${name}-optional`} />
                    <Label
                      htmlFor={`${name}-optional`}
                      className="font-normal cursor-pointer text-gray-600"
                    >
                      Opcional
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="required" id={`${name}-required`} />
                    <Label
                      htmlFor={`${name}-required`}
                      className="font-normal cursor-pointer font-medium"
                    >
                      Obrigatório
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="page-container">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="page-title"><ListTodo className="h-8 w-8" />Campos do Formulário</h1>
            <p className="mt-1 text-slate-500">Configure quais campos são exibidos durante o registro de visitantes e suas obrigatoriedades.</p>
          </div>
          <div className="hidden text-right text-sm text-slate-500 sm:block">
            <div className="flex items-center justify-end gap-2 font-semibold text-slate-600"><span>Olá, {user?.name}</span><CircleUserRound className="h-5 w-5" /></div>
            <div className="mt-2 flex items-center justify-end gap-2"><span>{format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span><CalendarDays className="h-5 w-5" /></div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12 text-muted-foreground">
            Carregando configurações...
          </div>
        ) : (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5"><h2 className="font-semibold text-[#012c61]">Regras do formulário de entrada</h2><p className="mt-1 text-sm text-slate-500">Nome, CPF e Setor de Destino são sempre obrigatórios.</p></div>
            <CardContent className="p-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="px-6 py-2">
                    <FieldRow
                      name="cpf"
                      label="CPF do Visitante"
                      description="Documento de identificação."
                    />
                    <FieldRow
                      name="phone"
                      label="Telefone"
                      description="Número para contato."
                    />
                    <FieldRow
                      name="company"
                      label="Empresa / Órgão"
                      description="Instituição que o visitante representa."
                    />
                    <FieldRow
                      name="city"
                      label="Cidade"
                      description="Município de origem."
                    />
                    <FieldRow
                      name="responsible"
                      label="Servidor Responsável"
                      description="Pessoa que irá receber o visitante."
                    />
                    <FieldRow
                      name="reason"
                      label="Motivo da Visita"
                      description="Assunto ou finalidade da entrada."
                    />
                    <FieldRow
                      name="notes"
                      label="Observações"
                      description="Campo de texto livre para anotações extras."
                    />
                  </div>

                  <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 p-6">
                    <Button
                      type="submit"
                      disabled={updateConfig.isPending}
                      className="h-11 gap-2 rounded-lg border-0 bg-[#012c61] px-5 font-semibold text-white hover:bg-[#01244f]"
                    >
                      <Save className="w-4 h-4" />
                      Salvar Configurações
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
