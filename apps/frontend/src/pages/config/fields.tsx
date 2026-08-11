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
import { Settings, Save, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
    <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100 last:border-0 gap-4">
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{label}</h4>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      {name === "cpf" ? (
        <span className="text-sm font-medium">Obrigatório</span>
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
                  className="flex items-center space-x-6"
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
      <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ListTodo className="w-8 h-8 text-primary" />
            Campos do Formulário
          </h1>
          <p className="text-gray-500 mt-1">
            Configure quais campos são exibidos durante o registro de visitantes
            e suas obrigatoriedades.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12 text-muted-foreground">
            Carregando configurações...
          </div>
        ) : (
          <Card>
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-lg">
                Regras do Formulário de Entrada
              </CardTitle>
              <CardDescription>
                Nome, CPF e Setor de Destino são sempre obrigatórios.
              </CardDescription>
            </CardHeader>
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

                  <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateConfig.isPending}
                      className="gap-2"
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
