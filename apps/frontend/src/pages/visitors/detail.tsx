import { useState, useRef } from "react";
import { maskCpf, isValidCpf, stripCpfMask } from "@/lib/cpf";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useGetVisitor,
  useUpdateVisitor,
  VisitorUpdate,
  getGetVisitorQueryKey,
} from "@visit-control/api-client";
import { useParams, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Building2,
  Cake,
  CalendarDays,
  CircleUserRound,
  IdCard,
  MapPin,
  Phone,
  Edit,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDateOnly } from "@/lib/utils";
import { can } from "@/lib/permissions";
import {
  formatBirthDate,
  isValidBirthDate,
  todayInSaoPaulo,
} from "@/lib/birth-date";

const visitorFieldPermissions = [
  "editVisitorName",
  "editVisitorCpf",
  "editVisitorBirthDate",
  "editVisitorPhone",
  "editVisitorCompany",
  "editVisitorCity",
] as const;

type VisitorPermission = (typeof visitorFieldPermissions)[number];

export default function VisitorDetail() {
  const { id } = useParams<{ id: string }>();
  const visitorId = parseInt(id, 10);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canEditField = (permission: VisitorPermission) => can(user, permission);
  const canEditVisitor = can(user, ...visitorFieldPermissions);
  const [birthDateError, setBirthDateError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: visitor, isLoading } = useGetVisitor(visitorId, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!visitorId } as any,
  });

  const updateVisitor = useUpdateVisitor();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<VisitorUpdate>({});
  const [cpfError, setCpfError] = useState("");

  const handleEditOpen = () => {
    if (visitor) {
      setCpfError("");
      setBirthDateError("");
      setEditForm({
        name: visitor.name,
        cpf: maskCpf(visitor.cpf || ""),
        birthDate: visitor.birthDate || "",
        phone: visitor.phone || "",
        company: visitor.company || "",
        city: visitor.city || "",
      });
      setIsEditOpen(true);
    }
  };

  const mutateFnRef = useRef(updateVisitor.mutate);
  mutateFnRef.current = updateVisitor.mutate;

  const handleSave = () => {
    const data: VisitorUpdate = {};
    if (canEditField("editVisitorName")) data.name = editForm.name;
    if (canEditField("editVisitorCpf")) {
      const rawCpf = editForm.cpf ? stripCpfMask(editForm.cpf) : "";
      if (!rawCpf) {
        setCpfError("CPF é obrigatório.");
        return;
      }
      if (!isValidCpf(rawCpf)) {
        setCpfError("CPF inválido.");
        return;
      }
      data.cpf = rawCpf;
    }
    if (canEditField("editVisitorBirthDate") && editForm.birthDate) {
      if (!isValidBirthDate(editForm.birthDate)) {
        setBirthDateError("Data de nascimento inválida.");
        return;
      }
      data.birthDate = editForm.birthDate;
    }
    setBirthDateError("");
    if (canEditField("editVisitorPhone")) data.phone = editForm.phone;
    if (canEditField("editVisitorCompany")) data.company = editForm.company;
    if (canEditField("editVisitorCity")) data.city = editForm.city;
    setCpfError("");
    mutateFnRef.current(
      { id: visitorId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetVisitorQueryKey(visitorId),
          });
          setIsEditOpen(false);
          toast({ title: "Visitante atualizado com sucesso" });
        },
        onError: (err: any) => {
          const msg = err.data?.error;
          if (err.response?.status === 409) {
            setCpfError(msg ?? "Já existe um visitante com este CPF.");
          } else {
            toast({
              variant: "destructive",
              title: "Erro ao atualizar visitante",
              description: msg,
            });
          }
        },
      },
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">
          Carregando perfil...
        </div>
      </AppLayout>
    );
  }

  if (!visitor) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">
          Visitante não encontrado.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="page-title">
              <UserRound className="h-8 w-8" />
              Perfil do Visitante
            </h1>
            <p className="mt-1 text-slate-500">Dados cadastrais e histórico de visitas.</p>
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

        <Card className="flex flex-col gap-6 border-slate-200 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-bold text-[#012c61] md:text-3xl">{visitor.name}</h2>
            <p className="mt-2 text-slate-500">
              Visitante desde {format(new Date(visitor.createdAt), "dd/MM/yyyy")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link href="/visitors">
              <Button variant="outline" className="h-11 w-full gap-2 rounded-lg border-[#174f8c]/50 px-5 text-[#012c61] hover:bg-[#174f8c]/10 sm:w-auto">
                <ArrowLeft className="h-4 w-4" />Voltar para visitantes
              </Button>
            </Link>
            {canEditVisitor && (
              <Button onClick={handleEditOpen} className="h-11 gap-2 rounded-lg border-0 bg-[#012c61] px-5 font-semibold text-white hover:bg-[#01244f]">
                <Edit className="h-4 w-4" />Editar Perfil
              </Button>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit overflow-hidden border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="font-semibold text-[#012c61]">Dados do visitante</h2>
            </div>
            <div className="divide-y divide-slate-100 px-6">
              <div className="flex gap-3 py-5">
                <IdCard className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">CPF</p>
                  <p className="mt-1 break-words font-medium text-slate-800">{visitor.cpf ? maskCpf(visitor.cpf) : "Não informado"}</p>
                </div>
              </div>
              <div className="flex gap-3 py-5">
                <Cake className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Data de nascimento</p>
                  <p className="mt-1 break-words font-medium text-slate-800">{formatBirthDate(visitor.birthDate)}</p>
                  {!visitor.birthDate && (
                    <p className="mt-1 text-xs text-amber-700">Será solicitada na próxima visita.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 py-5">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Telefone</p>
                  <p className="mt-1 break-words font-medium text-slate-800">{visitor.phone || "Não informado"}</p>
                </div>
              </div>
              <div className="flex gap-3 py-5">
                <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Empresa/Órgão</p>
                  <p className="mt-1 break-words font-medium text-slate-800">{visitor.company || "Não informada"}</p>
                </div>
              </div>
              <div className="flex gap-3 py-5">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Cidade</p>
                  <p className="mt-1 break-words font-medium text-slate-800">{visitor.city || "Não informada"}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="font-semibold text-[#012c61]">Histórico de visitas</h2>
              <p className="mt-1 text-sm text-slate-500">
                {visitor.visits?.length || 0} {(visitor.visits?.length || 0) === 1 ? "visita" : "visitas"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-[9%]">ID</TableHead>
                    <TableHead className="w-[17%]">Data</TableHead>
                    <TableHead className="w-[27%]">Setor de destino</TableHead>
                    <TableHead className="w-[15%]">Entrada</TableHead>
                    <TableHead className="w-[14%]">Saída</TableHead>
                    <TableHead className="w-[18%]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!visitor.visits || visitor.visits.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-gray-500"
                      >
                        Nenhuma visita registrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visitor.visits.map((visit) => (
                      <TableRow key={visit.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-xs text-slate-500">
                          <Link href={`/visits/${visit.id}`} className="font-medium text-[#012c61] hover:underline">
                            #{visit.id}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDateOnly(visit.entryDate)}</TableCell>
                        <TableCell className="truncate text-sm font-medium" title={visit.sector?.name || `Setor #${visit.sectorId}`}>
                          {visit.sector?.name || `Setor #${visit.sectorId}`}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-slate-600">{visit.entryTime}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-slate-600">{visit.exitTime || "-"}</TableCell>
                        <TableCell>
                          <StatusBadge status={visit.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Visitante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!isAdmin && (
              <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Os campos desabilitados não estão liberados para o seu usuário.
              </p>
            )}
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={editForm.name || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                disabled={!canEditField("editVisitorName")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input
                  value={editForm.cpf || ""}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  onChange={(e) => {
                    const masked = maskCpf(e.target.value);
                    setEditForm({ ...editForm, cpf: masked });
                    if (cpfError) setCpfError("");
                  }}
                  disabled={!canEditField("editVisitorCpf")}
                />
                {cpfError && (
                  <p className="text-sm text-destructive">{cpfError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  min="1900-01-01"
                  max={todayInSaoPaulo()}
                  value={editForm.birthDate || ""}
                  onChange={(e) => {
                    setEditForm({ ...editForm, birthDate: e.target.value });
                    if (birthDateError) setBirthDateError("");
                  }}
                  disabled={!canEditField("editVisitorBirthDate")}
                />
                {birthDateError && (
                  <p className="text-sm text-destructive">{birthDateError}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={editForm.phone || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  disabled={!canEditField("editVisitorPhone")}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={editForm.city || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, city: e.target.value })
                  }
                  disabled={!canEditField("editVisitorCity")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Empresa/Órgão</Label>
              <Input
                value={editForm.company || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, company: e.target.value })
                }
                disabled={!canEditField("editVisitorCompany")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateVisitor.isPending}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
