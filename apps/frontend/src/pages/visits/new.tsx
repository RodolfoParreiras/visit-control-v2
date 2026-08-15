import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreateVisit,
  useListSectors,
  useGetFieldConfig,
  useSearchVisitors,
  useGetVisitor,
  useGetLabelConfig,
  getGetVisitorQueryKey,
  getListVisitsQueryKey,
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
  CalendarDays,
  CircleUserRound,
  Pencil,
  ArrowLeft,
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

export default function VisitNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const preselectedId = new URLSearchParams(search).get("visitorId");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState<any>(null);
  const [createdVisit, setCreatedVisit] = useState<Visit | null>(null);
  const [conflictingVisitId, setConflictingVisitId] = useState<number | null>(
    null,
  );
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

  const { data: selectedVisitorDetails, isLoading: checkingOngoingVisit } =
    useGetVisitor(
      Number(selectedVisitor?.id ?? 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { query: { enabled: !!selectedVisitor?.id } } as any,
    );
  const ongoingVisit = (selectedVisitorDetails as any)?.visits?.find(
    (visit: any) => visit.status === "ongoing",
  );
  const ongoingVisitId = ongoingVisit?.id ?? conflictingVisitId;

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
    setConflictingVisitId(null);
    setSearchTerm("");
  };

  const handleReset = () => {
    setSelectedVisitor(null);
    setSearchTerm("");
    setCreatedVisit(null);
    setConflictingVisitId(null);
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
    if (ongoingVisitId) {
      toast({
        variant: "destructive",
        title: "Visita já em andamento",
        description:
          "Finalize ou cancele a visita atual antes de registrar uma nova entrada.",
      });
      return;
    }

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
          const visitorQueryKey = getGetVisitorQueryKey(selectedVisitor.id);

          // Atualiza imediatamente o histórico usado para detectar uma visita aberta.
          queryClient.setQueryData(visitorQueryKey, (current: any) =>
            current
              ? {
                  ...current,
                  visits: [
                    res,
                    ...(current.visits ?? []).filter(
                      (visit: any) => visit.id !== res.id,
                    ),
                  ],
                }
              : current,
          );
          setCreatedVisit(res);
          void Promise.all([
            queryClient.invalidateQueries({
              queryKey: getListVisitsQueryKey(),
            }),
            queryClient.invalidateQueries({ queryKey: visitorQueryKey }),
          ]);
          toast({ title: "Visita registrada com sucesso!" });
        },
        onError: (err: any) => {
          const responseData = err.response?.data;
          const msg = responseData?.error;
          if (responseData?.code === "VISITOR_HAS_ONGOING_VISIT") {
            setConflictingVisitId(responseData.visitId);
          }
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

  const pageHeader = (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#012c61]">
          <UserPlus className="h-8 w-8" />
          Nova Visita
        </h1>
        <p className="mt-1 text-slate-500">
          Registre a entrada de um visitante no prédio.
        </p>
      </div>
      <div className="hidden text-right text-sm text-slate-500 sm:block">
        <div className="flex items-center justify-end gap-2 font-semibold text-slate-600">
          <span>Olá, {user?.name}</span>
          <CircleUserRound className="h-5 w-5" />
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <span>
            {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <CalendarDays className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  // Success screen
  if (createdVisit && labelConfig) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
          {pageHeader}
          <div className="no-print">
            <Card className="border-slate-200 bg-white shadow-sm">
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
                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  <Button
                    onClick={() => setLocation("/visits")}
                    variant="outline"
                    className="w-44 gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para visitas
                  </Button>
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
                    className="w-40 gap-2 border-0 bg-[#012c61] text-white hover:bg-[#01244f]"
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
      <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        {pageHeader}

        {/* Step 1 — Visitor search */}
        {!selectedVisitor && (
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-lg text-[#012c61]">
                <Search className="h-5 w-5" />
                Identificar Visitante
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Digite o nome, CPF ou empresa para buscar..."
                  className="h-11 rounded-lg border-slate-300 pl-11 text-base focus-visible:ring-[#174f8c]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              {debouncedSearch.length >= 2 && (
                <div className="divide-y overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  {searching ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Buscando...
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <>
                      {searchResults.map((v: any) => (
                        <div
                          key={v.id}
                          className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-slate-50"
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
                            className="text-[#174f8c] hover:bg-[#174f8c]/10 hover:text-[#012c61]"
                          >
                            Selecionar
                          </Button>
                        </div>
                      ))}
                      <div className="border-t bg-slate-50 p-3 text-center">
                        <span className="text-sm text-gray-600 mr-2">
                          Não é nenhum destes?
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation("/visitors/new")}
                        >
                          Cadastrar novo
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center space-y-3">
                      <AlertCircle className="w-8 h-8 text-gray-400 mx-auto" />
                      <p className="text-gray-600">
                        Visitante não encontrado no sistema.
                      </p>
                      <Button
                        className="bg-[#012c61] hover:bg-[#01244f]"
                        onClick={() => setLocation("/visitors/new")}
                      >
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
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-100 bg-white px-6 py-5">
                  <CardTitle className="flex items-center gap-2 text-lg text-[#012c61]">
                    <UserCheck className="h-5 w-5 text-green-600" />
                    Visitante Identificado
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 gap-1.5 text-[#174f8c] hover:bg-[#174f8c]/10 hover:text-[#012c61]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Alterar
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-x-10 gap-y-4 text-sm sm:grid-cols-2 md:grid-cols-3">
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

              {ongoingVisitId && (
                <Card className="border-amber-200 bg-amber-50 shadow-sm">
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div>
                        <p className="font-semibold text-amber-950">
                          Este visitante já possui uma visita em andamento
                        </p>
                        <p className="mt-1 text-sm text-amber-800">
                          {ongoingVisit?.sector?.name
                            ? `Setor: ${ongoingVisit.sector.name}. `
                            : ""}
                          Finalize ou cancele a visita atual antes de registrar
                          uma nova entrada.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation(`/visits/${ongoingVisitId}`)}
                      className="shrink-0 border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                    >
                      Ver visita em andamento
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Visit details */}
              {!ongoingVisitId && (
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                  <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
                    <CardTitle className="text-lg text-[#012c61]">
                      Detalhes da Visita
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
                                <SelectTrigger
                                  ref={sectorRef}
                                  className="h-11 rounded-lg border-slate-300 focus:ring-[#174f8c]"
                                >
                                  <SelectValue placeholder="Selecione o setor" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sectors?.map((s) => (
                                  <SelectItem
                                    key={s.id}
                                    value={s.id.toString()}
                                  >
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
                                <Input
                                  {...field}
                                  className="h-11 rounded-lg border-slate-300 focus-visible:ring-[#174f8c]"
                                />
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
                                Motivo{" "}
                                {fieldConfig?.reason === "required" && "*"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="h-11 rounded-lg border-slate-300 focus-visible:ring-[#174f8c]"
                                />
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
                                <Input
                                  {...field}
                                  className="h-11 rounded-lg border-slate-300 focus-visible:ring-[#174f8c]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {!ongoingVisitId && (
                <div className="flex flex-col-reverse justify-end gap-4 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="h-11 w-full rounded-lg border-slate-300 sm:w-36"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createVisit.isPending || checkingOngoingVisit}
                    className="h-11 w-full rounded-lg border-0 bg-[#012c61] text-base font-semibold text-white hover:bg-[#01244f] sm:w-52"
                  >
                    {checkingOngoingVisit
                      ? "Verificando..."
                      : createVisit.isPending
                        ? "Registrando..."
                        : "Registrar Entrada"}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        )}
      </div>
    </AppLayout>
  );
}
