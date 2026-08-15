import { useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useGetVisit,
  useUpdateVisit,
  useCheckoutVisit,
  useCancelVisit,
  useListSectors,
  useGetLabelConfig,
  getGetVisitQueryKey,
  getGetVisitorQueryKey,
  getListVisitsQueryKey,
} from "@visit-control/api-client";
import { Link, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlignLeft,
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  Clock,
  Edit,
  LogOut as CheckoutIcon,
  Printer,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateOnly } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrintLabel } from "@/components/PrintLabel";
import { printVisitLabel } from "@/lib/print-label";
import { maskCpf } from "@/lib/cpf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function VisitDetail() {
  const { id } = useParams<{ id: string }>();
  const visitId = parseInt(id, 10);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: visit, isLoading } = useGetVisit(visitId, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!visitId } as any,
  });
  const { data: sectors } = useListSectors();
  const { data: labelConfig } = useGetLabelConfig();

  const checkoutVisit = useCheckoutVisit();
  const cancelVisit = useCancelVisit();
  const updateVisit = useUpdateVisit();
  const labelRef = useRef<HTMLDivElement>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    sectorId: "",
    responsible: "",
    reason: "",
    notes: "",
  });

  const refreshVisitData = (visitorId: number) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetVisitQueryKey(visitId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetVisitorQueryKey(visitorId),
      }),
      queryClient.invalidateQueries({ queryKey: getListVisitsQueryKey() }),
    ]);

  const handlePrint = () => {
    if (labelRef.current && labelConfig) {
      printVisitLabel(
        labelRef.current,
        labelConfig.labelWidth ?? 100,
        labelConfig.labelHeight ?? 60,
      );
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">
          Carregando visita...
        </div>
      </AppLayout>
    );
  }

  if (!visit) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">
          Visita não encontrada.
        </div>
      </AppLayout>
    );
  }

  const handleCheckout = () => {
    if (confirm("Confirmar a saída deste visitante?")) {
      checkoutVisit.mutate(
        { id: visitId },
        {
          onSuccess: () => {
            void refreshVisitData(visit.visitorId);
            toast({ title: "Saída registrada com sucesso" });
          },
          onError: () =>
            toast({
              variant: "destructive",
              title: "Erro ao registrar saída",
            }),
        },
      );
    }
  };

  const handleCancelSubmit = () => {
    if (!cancelReason) return;

    cancelVisit.mutate(
      { id: visitId, data: { reason: cancelReason } },
      {
        onSuccess: () => {
          void refreshVisitData(visit.visitorId);
          setCancelModalOpen(false);
          setCancelReason("");
          toast({ title: "Visita cancelada" });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Erro ao cancelar visita",
          }),
      },
    );
  };

  const openEditModal = () => {
    setEditForm({
      sectorId: visit.sectorId.toString(),
      responsible: visit.responsible || "",
      reason: visit.reason || "",
      notes: visit.notes || "",
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = () => {
    updateVisit.mutate(
      {
        id: visitId,
        data: {
          sectorId: parseInt(editForm.sectorId, 10),
          responsible: editForm.responsible,
          reason: editForm.reason,
          notes: editForm.notes,
        },
      },
      {
        onSuccess: () => {
          void refreshVisitData(visit.visitorId);
          setEditModalOpen(false);
          toast({ title: "Visita atualizada com sucesso" });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Erro ao atualizar visita",
          }),
      },
    );
  };

  return (
    <AppLayout>
      <div className="no-print mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-[#012c61]">
              <ClipboardList className="h-8 w-8" />
              Detalhes da Visita
            </h1>
            <p className="mt-1 text-slate-500">
              Informações completas e movimentação do registro.
            </p>
          </div>
          <div className="hidden text-right text-sm text-slate-500 sm:block">
            <div className="flex items-center justify-end gap-2 font-semibold text-slate-600">
              <span>Olá, {user?.name}</span>
              <CircleUserRound className="h-5 w-5" />
            </div>
            <div className="mt-2 flex items-center justify-end gap-2">
              <span>
                {format(new Date(), "d 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
              </span>
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
        </div>

        <Card className="flex flex-col gap-6 border-slate-200 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-[#012c61] md:text-3xl">
                Registro #{visit.id}
              </h2>
              <StatusBadge status={visit.status} />
            </div>
            <p className="mt-2 flex items-center gap-2 text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Entrada em {formatDateOnly(visit.entryDate)} às {visit.entryTime}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/visits">
              <Button
                variant="outline"
                className="h-11 gap-2 rounded-lg border-[#174f8c]/50 px-4 text-[#012c61] hover:bg-[#174f8c]/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para visitas
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={!labelConfig}
              className="h-11 gap-2 rounded-lg border-slate-300 bg-white px-4 text-[#012c61] hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Etiqueta
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={openEditModal}
                className="h-11 gap-2 rounded-lg border-slate-300 bg-white px-4 text-[#012c61] hover:bg-[#174f8c]/10"
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            )}
            {visit.status === "ongoing" && (
              <Button
                variant="outline"
                onClick={handleCheckout}
                disabled={checkoutVisit.isPending}
                className="h-11 gap-2 rounded-lg border-slate-300 bg-white px-4 text-[#012c61] hover:border-red-600 hover:bg-red-600 hover:text-white"
              >
                <CheckoutIcon className="h-4 w-4" />
                {checkoutVisit.isPending ? "Registrando..." : "Registrar Saída"}
              </Button>
            )}
            {isAdmin && visit.status === "ongoing" && (
              <Button
                variant="outline"
                onClick={() => setCancelModalOpen(true)}
                className="h-11 gap-2 rounded-lg border-slate-300 bg-white px-4 text-[#012c61] hover:border-red-600 hover:bg-red-600 hover:text-white"
              >
                <Ban className="h-4 w-4" />
                Cancelar visita
              </Button>
            )}
          </div>
        </Card>

        {visit.status === "cancelled" && visit.cancelReason && (
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <Ban className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h3 className="font-semibold">Visita cancelada</h3>
              <p className="mt-1 text-sm">{visit.cancelReason}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-lg text-[#012c61]">
                <UserRound className="h-5 w-5 text-slate-500" />
                Dados do visitante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div>
                <Label className="text-sm text-slate-500">Nome</Label>
                <p className="mt-1 break-words font-semibold text-slate-900">
                  {visit.visitor?.name || "Não informado"}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Label className="text-sm text-slate-500">CPF</Label>
                  <p className="mt-1 font-medium text-slate-800">
                    {visit.visitor?.cpf
                      ? maskCpf(visit.visitor.cpf)
                      : "Não informado"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-slate-500">Telefone</Label>
                  <p className="mt-1 font-medium text-slate-800">
                    {visit.visitor?.phone || "Não informado"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-slate-500">
                    Empresa/Órgão
                  </Label>
                  <p className="mt-1 break-words font-medium text-slate-800">
                    {visit.visitor?.company || "Não informada"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-slate-500">Cidade</Label>
                  <p className="mt-1 break-words font-medium text-slate-800">
                    {visit.visitor?.city || "Não informada"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-lg text-[#012c61]">
                <Building2 className="h-5 w-5 text-slate-500" />
                Destino e movimentação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Label className="text-sm text-slate-500">Setor</Label>
                  <p className="mt-1 font-semibold text-slate-900">
                    {visit.sector?.name || "Não informado"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-slate-500">Responsável</Label>
                  <p className="mt-1 font-medium text-slate-800">
                    {visit.responsible || "Não informado"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div>
                  <Label className="text-sm text-slate-500">Entrada</Label>
                  <p className="mt-1 flex items-center gap-2 font-medium text-slate-800">
                    <Clock className="h-4 w-4 text-green-600" />
                    {formatDateOnly(visit.entryDate)} às {visit.entryTime}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Registrada por {visit.entryUser?.name || "Sistema"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-slate-500">Saída</Label>
                  <p className="mt-1 flex items-center gap-2 font-medium text-slate-800">
                    <CheckoutIcon className="h-4 w-4 text-red-500" />
                    {visit.exitDate && visit.exitTime
                      ? `${formatDateOnly(visit.exitDate)} às ${visit.exitTime}`
                      : "Ainda não registrada"}
                  </p>
                  {visit.exitUser && (
                    <p className="mt-1 text-sm text-slate-500">
                      Registrada por {visit.exitUser.name}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-lg text-[#012c61]">
                <AlignLeft className="h-5 w-5 text-slate-500" />
                Informações adicionais
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
              <div>
                <Label className="text-sm text-slate-500">
                  Motivo da visita
                </Label>
                <p className="mt-2 whitespace-pre-wrap text-slate-800">
                  {visit.reason || "Não informado"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-slate-500">Observações</Label>
                <div className="mt-2 min-h-16 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-slate-700">
                  {visit.notes || "Nenhuma observação registrada."}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {labelConfig && (
        <div
          ref={labelRef}
          style={{ position: "fixed", left: "-9999px", top: 0 }}
          aria-hidden
        >
          <PrintLabel visit={visit} config={labelConfig} />
        </div>
      )}

      {isAdmin && (
        <>
          <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <Ban className="h-5 w-5" />
                  Cancelar visita
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-slate-600">
                  Informe o motivo do cancelamento desta visita.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">Motivo do cancelamento</Label>
                  <Input
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    placeholder="Ex.: visitante não compareceu"
                    className="h-11 rounded-lg border-slate-300"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCancelModalOpen(false)}
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelSubmit}
                  disabled={!cancelReason.trim() || cancelVisit.isPending}
                >
                  {cancelVisit.isPending ? "Cancelando..." : "Confirmar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-[#012c61]">
                  Editar informações da visita
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Setor de destino</Label>
                  <Select
                    value={editForm.sectorId}
                    onValueChange={(sectorId) =>
                      setEditForm({ ...editForm, sectorId })
                    }
                  >
                    <SelectTrigger className="h-11 rounded-lg border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors?.map((sector) => (
                        <SelectItem
                          key={sector.id}
                          value={sector.id.toString()}
                        >
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input
                    value={editForm.responsible}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        responsible: event.target.value,
                      })
                    }
                    className="h-11 rounded-lg border-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Input
                    value={editForm.reason}
                    onChange={(event) =>
                      setEditForm({ ...editForm, reason: event.target.value })
                    }
                    className="h-11 rounded-lg border-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input
                    value={editForm.notes}
                    onChange={(event) =>
                      setEditForm({ ...editForm, notes: event.target.value })
                    }
                    className="h-11 rounded-lg border-slate-300"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleEditSubmit}
                  disabled={updateVisit.isPending}
                  className="border-0 bg-[#012c61] text-white hover:bg-[#01244f]"
                >
                  {updateVisit.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </AppLayout>
  );
}
