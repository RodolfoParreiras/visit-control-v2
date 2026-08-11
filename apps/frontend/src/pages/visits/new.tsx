import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useCreateVisit,
  useListSectors,
  useGetFieldConfig,
  useSearchVisitors,
  useGetVisitor,
  useGetLabelConfig,
  Visit,
} from "@visit-control/api-client";
import { maskCpf } from "@/lib/cpf";
import {
  UserPlus,
  Search,
  UserCheck,
  AlertCircle,
  Printer,
  CheckCircle2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PrintLabel } from "@/components/PrintLabel";
import { printVisitLabel } from "@/lib/print-label";

export default function VisitNew() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const preselectedId = new URLSearchParams(search).get("visitorId");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState<any>(null);
  const [createdVisit, setCreatedVisit] = useState<Visit | null>(null);
  const sectorRef = useRef<HTMLButtonElement>(null);

  const { data: fieldConfig, isLoading: configLoading } = useGetFieldConfig();
  const { data: sectors } = useListSectors({ status: "active" });
  const { data: labelConfig } = useGetLabelConfig();
  const createVisit = useCreateVisit();

  // Fetch visitor pre-selected via query param (redirect from /visitors/new)
  const { data: preselectedVisitor } = useGetVisitor(
    Number(preselectedId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {
      query: { enabled: !!preselectedId && !isNaN(Number(preselectedId)) },
    } as any,
  );

  // Auto-select the pre-selected visitor and focus the sector field
  useEffect(() => {
    if (preselectedVisitor && !selectedVisitor) {
      setSelectedVisitor(preselectedVisitor);
      setTimeout(() => sectorRef.current?.focus(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedVisitor]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: searchResults, isLoading: searching } = useSearchVisitors(
    { q: debouncedSearch },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: debouncedSearch.length >= 2 } } as any,
  );

  // Visit-only schema — visitor data is separate
  const createSchema = () => {
    const s: Record<string, z.ZodTypeAny> = {
      sectorId: z.string().min(1, "Setor é obrigatório"),
      responsible: z.string().optional(),
      reason: z.string().optional(),
      notes: z.string().optional(),
    };
    if (!fieldConfig) return z.object(s);

    const mapRules = (field: string) => {
      const status = fieldConfig[field as keyof typeof fieldConfig];
      if (status === "required") return z.string().min(1, "Campo obrigatório");
      return z.string().optional();
    };
    if (fieldConfig?.responsible !== "hidden")
      s.responsible = mapRules("responsible");
    if (fieldConfig?.reason !== "hidden") s.reason = mapRules("reason");
    if (fieldConfig?.notes !== "hidden") s.notes = mapRules("notes");

    return z.object(s);
  };

  const form = useForm({
    resolver: zodResolver(createSchema()),
    defaultValues: { sectorId: "", responsible: "", reason: "", notes: "" },
  });

  useEffect(() => {
    if (fieldConfig) {
      form.clearErrors();
    }
  }, [fieldConfig, form]);

  const selectVisitor = (visitor: any) => {
    setSelectedVisitor(visitor);
    setSearchTerm("");
  };

  const handleReset = () => {
    setSelectedVisitor(null);
    setSearchTerm("");
    setCreatedVisit(null);
    form.reset({ sectorId: "", responsible: "", reason: "", notes: "" });
    setLocation("/visits/new");
  };

  const labelRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (labelRef.current && labelConfig) {
      printVisitLabel(
        labelRef.current,
        labelConfig.labelWidth ?? 100,
        labelConfig.labelHeight ?? 60,
      );
    }
  };

  const onSubmit = (data: any) => {
    const payload: any = {
      visitorId: selectedVisitor.id,
      sectorId: parseInt(data.sectorId, 10),
    };
    if (fieldConfig?.responsible !== "hidden")
      payload.responsible = data.responsible;
    if (fieldConfig?.reason !== "hidden") payload.reason = data.reason;
    if (fieldConfig?.notes !== "hidden") payload.notes = data.notes;

    createVisit.mutate(
      { data: payload },
      {
        onSuccess: (res) => {
          setCreatedVisit(res);
          toast({ title: "Visita registrada com sucesso!" });
        },
        onError: (err: any) => {
          const msg = err.response?.data?.error;
          toast({
            variant: "destructive",
            title: "Erro ao registrar visita",
            description: msg,
          });
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

  // Success screen
  if (createdVisit && labelConfig) {
    return (
      <AppLayout>
        <div className="p-6 md:p-8 max-w-3xl mx-auto w-full">
          <div className="no-print">
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Entrada Registrada!
                  </h2>
                  <p className="text-gray-600 mt-2">
                    A visita de{" "}
                    <span className="font-semibold">
                      {createdVisit.visitor?.name}
                    </span>{" "}
                    para o setor{" "}
                    <span className="font-semibold">
                      {createdVisit.sector?.name}
                    </span>{" "}
                    foi confirmada.
                  </p>
                </div>
                <div className="flex justify-center gap-4 pt-4">
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="w-40"
                  >
                    Nova Visita
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePrint}
                    disabled={!labelConfig}
                    className="w-40 gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Etiqueta
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="print-only">
            <PrintLabel visit={createdVisit} config={labelConfig} />
          </div>
        </div>

        {/* Elemento oculto usado como fonte para a janela de impressão */}
        {labelConfig && (
          <div
            ref={labelRef}
            style={{ position: "fixed", left: "-9999px", top: 0 }}
            aria-hidden
          >
            <PrintLabel visit={createdVisit} config={labelConfig} />
          </div>
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <UserPlus className="w-8 h-8 text-primary" />
            Nova Visita
          </h1>
          <p className="text-gray-500 mt-1">
            Registre a entrada de um visitante no prédio.
          </p>
        </div>

        {/* Step 1 — Visitor search */}
        {!selectedVisitor && (
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <Search className="w-5 h-5" />
                Identificar Visitante
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Digite o nome, CPF ou empresa para buscar..."
                  className="pl-10 h-12 text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              {debouncedSearch.length >= 2 && (
                <div className="bg-white border rounded-md shadow-sm divide-y">
                  {searching ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Buscando...
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <>
                      {searchResults.map((v: any) => (
                        <div
                          key={v.id}
                          className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                          onClick={() => selectVisitor(v)}
                        >
                          <div>
                            <div className="font-semibold text-gray-900">
                              {v.name}
                            </div>
                            <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                              {v.cpf && <span>CPF: {v.cpf}</span>}
                              {v.company && <span>Empresa: {v.company}</span>}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600"
                          >
                            Selecionar
                          </Button>
                        </div>
                      ))}
                      <div className="p-3 bg-gray-50 text-center border-t">
                        <span className="text-sm text-gray-600 mr-2">
                          Não é nenhum destes?
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation("/visitors/new")}
                        >
                          Cadastrar Novo
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center space-y-3">
                      <AlertCircle className="w-8 h-8 text-gray-400 mx-auto" />
                      <p className="text-gray-600">
                        Visitante não encontrado no sistema.
                      </p>
                      <Button onClick={() => setLocation("/visitors/new")}>
                        Cadastrar Novo Visitante
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Visit form (visitor already selected) */}
        {selectedVisitor && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Read-only visitor card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between bg-gray-50/50 border-b border-gray-100 pb-3 pt-4 px-6">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-green-600" />
                    Visitante Identificado
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 text-muted-foreground gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Alterar
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs uppercase tracking-wide">
                        Nome
                      </span>
                      <p className="font-semibold text-gray-900 mt-0.5">
                        {selectedVisitor.name}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase tracking-wide">
                        CPF
                      </span>
                      <p className="font-mono text-gray-800 mt-0.5">
                        {maskCpf(selectedVisitor.cpf)}
                      </p>
                    </div>
                    {selectedVisitor.phone && (
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide">
                          Telefone
                        </span>
                        <p className="text-gray-800 mt-0.5">
                          {selectedVisitor.phone}
                        </p>
                      </div>
                    )}
                    {selectedVisitor.company && (
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide">
                          Empresa/Órgão
                        </span>
                        <p className="text-gray-800 mt-0.5">
                          {selectedVisitor.company}
                        </p>
                      </div>
                    )}
                    {selectedVisitor.city && (
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide">
                          Cidade
                        </span>
                        <p className="text-gray-800 mt-0.5">
                          {selectedVisitor.city}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Visit details */}
              <Card>
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-3 pt-4 px-6">
                  <CardTitle className="text-base">
                    Detalhes da Visita
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sectorId"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Setor de Destino *</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.trigger("sectorId");
                            }}
                          >
                            <FormControl>
                              <SelectTrigger ref={sectorRef}>
                                <SelectValue placeholder="Selecione o setor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {sectors?.map((s) => (
                                <SelectItem key={s.id} value={s.id.toString()}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {fieldConfig?.responsible !== "hidden" && (
                      <FormField
                        control={form.control}
                        name="responsible"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Servidor Responsável{" "}
                              {fieldConfig?.responsible === "required" && "*"}
                            </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {fieldConfig?.reason !== "hidden" && (
                      <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Motivo {fieldConfig?.reason === "required" && "*"}
                            </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {fieldConfig?.notes !== "hidden" && (
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>
                              Observações{" "}
                              {fieldConfig?.notes === "required" && "*"}
                            </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="w-32"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createVisit.isPending}
                  className="w-48 text-base font-semibold"
                >
                  {createVisit.isPending
                    ? "Registrando..."
                    : "Registrar Entrada"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </AppLayout>
  );
}
