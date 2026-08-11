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
  User,
  Building2,
  MapPin,
  Phone,
  Edit,
  Calendar,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDateOnly } from "@/lib/utils";

const defaultVisitorPermissions = {
  editVisitorName: true,
  editVisitorCpf: true,
  editVisitorPhone: true,
  editVisitorCompany: true,
  editVisitorCity: true,
};

type VisitorPermission = keyof typeof defaultVisitorPermissions;

export default function VisitorDetail() {
  const { id } = useParams<{ id: string }>();
  const visitorId = parseInt(id, 10);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const visitorPermissions = {
    ...defaultVisitorPermissions,
    ...user?.permissions,
  };
  const canEditField = (permission: VisitorPermission) =>
    isAdmin ||
    (user?.role === "receptionist" && visitorPermissions[permission]);
  const canEditVisitor =
    isAdmin ||
    (user?.role === "receptionist" &&
      Object.values(visitorPermissions).some(Boolean));
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
      setEditForm({
        name: visitor.name,
        cpf: maskCpf(visitor.cpf || ""),
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
          const msg = err.response?.data?.error;
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
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              {visitor.name}
            </h1>
            <p className="text-gray-500 mt-1 ml-13">
              Visitante desde{" "}
              {format(new Date(visitor.createdAt), "dd/MM/yyyy")}
            </p>
          </div>
          {canEditVisitor && (
            <Button
              onClick={handleEditOpen}
              variant="outline"
              className="gap-2"
            >
              <Edit className="w-4 h-4" /> Editar Perfil
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="md:col-span-1 border-t-4 border-t-primary shadow-sm h-fit">
            <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-base">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">CPF</Label>
                <div className="font-mono text-sm mt-0.5">
                  {visitor.cpf || "Não informado"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Telefone
                </Label>
                <div className="text-sm mt-0.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {visitor.phone || "Não informado"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Empresa/Órgão
                </Label>
                <div className="text-sm mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {visitor.company || "Não informada"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cidade</Label>
                <div className="text-sm mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {visitor.city || "Não informada"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3 shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Histórico de Visitas
              </CardTitle>
              <div className="text-sm font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                {visitor.visits?.length || 0} visitas
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/30">
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Setor de Destino</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Status</TableHead>
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
                      <TableRow key={visit.id} className="hover:bg-blue-50/50">
                        <TableCell className="font-mono text-xs text-gray-500">
                          <Link
                            href={`/visits/${visit.id}`}
                            className="hover:underline text-primary"
                          >
                            #{visit.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDateOnly(visit.entryDate)}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {visit.sector?.name || `Setor #${visit.sectorId}`}
                        </TableCell>
                        <TableCell className="font-mono text-sm flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-gray-400" />{" "}
                          {visit.entryTime}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-gray-500">
                          {visit.exitTime || "-"}
                        </TableCell>
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
                Os campos desabilitados só podem ser alterados por um administrador.
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
                <Label>Telefone</Label>
                <Input
                  value={editForm.phone || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  disabled={!canEditField("editVisitorPhone")}
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
