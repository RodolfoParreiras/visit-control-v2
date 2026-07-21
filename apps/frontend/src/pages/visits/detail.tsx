import { useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  useGetVisit, 
  useUpdateVisit, 
  useCheckoutVisit, 
  useCancelVisit,
  useListSectors,
  useGetLabelConfig,
  getGetVisitQueryKey
} from '@visit-control/api-client';
import { useParams, Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  ClipboardList, 
  User, 
  Building2, 
  Clock, 
  LogOut as CheckoutIcon, 
  Printer, 
  Ban,
  Edit,
  AlignLeft,
  CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateOnly } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PrintLabel } from '@/components/PrintLabel';
import { printVisitLabel } from '@/lib/print-label';

export default function VisitDetail() {
  const { id } = useParams<{ id: string }>();
  const visitId = parseInt(id, 10);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: visit, isLoading } = useGetVisit(visitId, { query: { enabled: !!visitId } as any });
  const { data: sectors } = useListSectors();
  const { data: labelConfig } = useGetLabelConfig();

  const checkoutVisit = useCheckoutVisit();
  const cancelVisit = useCancelVisit();
  const updateVisit = useUpdateVisit();

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

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    sectorId: '',
    responsible: '',
    reason: '',
    notes: ''
  });

  if (isLoading) return <AppLayout><div className="p-8 text-center text-muted-foreground">Carregando visita...</div></AppLayout>;
  if (!visit) return <AppLayout><div className="p-8 text-center text-muted-foreground">Visita não encontrada.</div></AppLayout>;

  const handleCheckout = () => {
    if (confirm('Confirmar a saída deste visitante?')) {
      checkoutVisit.mutate({ id: visitId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetVisitQueryKey(visitId) });
          toast({ title: 'Saída registrada com sucesso' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao registrar saída' })
      });
    }
  };

  const handleCancelSubmit = () => {
    if (cancelReason) {
      cancelVisit.mutate({ id: visitId, data: { reason: cancelReason } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetVisitQueryKey(visitId) });
          setCancelModalOpen(false);
          toast({ title: 'Visita cancelada' });
        },
        onError: () => toast({ variant: 'destructive', title: 'Erro ao cancelar visita' })
      });
    }
  };

  const openEditModal = () => {
    setEditForm({
      sectorId: visit.sectorId.toString(),
      responsible: visit.responsible || '',
      reason: visit.reason || '',
      notes: visit.notes || '',
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = () => {
    updateVisit.mutate({ 
      id: visitId, 
      data: {
        sectorId: parseInt(editForm.sectorId, 10),
        responsible: editForm.responsible,
        reason: editForm.reason,
        notes: editForm.notes
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetVisitQueryKey(visitId) });
        setEditModalOpen(false);
        toast({ title: 'Visita atualizada com sucesso' });
      },
      onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar visita' })
    });
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6 no-print">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                Registro #{visit.id}
              </h1>
              <StatusBadge status={visit.status} />
            </div>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> {formatDateOnly(visit.entryDate)} às {visit.entryTime}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePrint} disabled={!labelConfig} className="gap-2 bg-white">
              <Printer className="w-4 h-4" /> Etiqueta
            </Button>
            
            {visit.status === 'ongoing' && (
              <Button onClick={handleCheckout} disabled={checkoutVisit.isPending} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
                <CheckoutIcon className="w-4 h-4" /> Registrar Saída
              </Button>
            )}

            {isAdmin && (
              <>
                <Button variant="outline" onClick={openEditModal} className="gap-2 bg-white">
                  <Edit className="w-4 h-4" /> Editar
                </Button>
                {visit.status === 'ongoing' && (
                  <Button variant="destructive" onClick={() => setCancelModalOpen(true)} className="gap-2">
                    <Ban className="w-4 h-4" /> Cancelar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {visit.status === 'cancelled' && visit.cancelReason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 text-red-800">
            <Ban className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Visita Cancelada</h4>
              <p className="text-sm mt-1">{visit.cancelReason}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="bg-gray-50/50 border-b pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Dados do Visitante
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <div className="font-semibold text-base mt-0.5">
                  <Link href={`/visitors/${visit.visitorId}`} className="text-primary hover:underline">
                    {visit.visitor?.name}
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">CPF</Label>
                  <div className="text-sm mt-0.5 font-mono">{visit.visitor?.cpf || '-'}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <div className="text-sm mt-0.5">{visit.visitor?.phone || '-'}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Empresa/Órgão</Label>
                  <div className="text-sm mt-0.5">{visit.visitor?.company || '-'}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cidade</Label>
                  <div className="text-sm mt-0.5">{visit.visitor?.city || '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-gray-50/50 border-b pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                Destino e Movimentação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Setor</Label>
                  <div className="font-semibold text-sm mt-0.5">{visit.sector?.name}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <div className="text-sm mt-0.5">{visit.responsible || '-'}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Entrada</Label>
                  <div className="text-sm mt-0.5 font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-green-600" />
                    {visit.entryTime}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">por {visit.entryUser?.name || 'Sistema'}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Saída</Label>
                  <div className="text-sm mt-0.5 font-mono flex items-center gap-1.5">
                    <CheckoutIcon className="w-3.5 h-3.5 text-orange-600" />
                    {visit.exitTime || '-'}
                  </div>
                  {visit.exitUser && <div className="text-xs text-gray-400 mt-1">por {visit.exitUser?.name}</div>}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="md:col-span-2">
            <CardHeader className="bg-gray-50/50 border-b pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlignLeft className="w-4 h-4 text-muted-foreground" />
                Informações Adicionais
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-xs text-muted-foreground">Motivo da Visita</Label>
                <div className="text-sm mt-1 whitespace-pre-wrap">{visit.reason || '-'}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <div className="text-sm mt-1 whitespace-pre-wrap text-gray-600 bg-gray-50 p-3 rounded-md min-h-[60px]">
                  {visit.notes || 'Nenhuma observação registrada.'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Elemento oculto usado como fonte para a janela de impressão */}
      {labelConfig && (
        <div ref={labelRef} style={{ position: 'fixed', left: '-9999px', top: 0}} aria-hidden>
          <PrintLabel visit={visit} config={labelConfig} />
        </div>
      )}

      {/* Admin Modals */}
      {isAdmin && (
        <>
          <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-red-600 flex items-center gap-2">
                  <Ban className="w-5 h-5" /> Cancelar Visita
                </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <p className="text-sm text-gray-600">Por favor, informe o motivo do cancelamento.</p>
                <div className="space-y-2">
                  <Label>Motivo do Cancelamento</Label>
                  <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Ex: Visitante não compareceu" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Desistir</Button>
                <Button variant="destructive" onClick={handleCancelSubmit} disabled={!cancelReason || cancelVisit.isPending}>Confirmar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Informações da Visita</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label>Setor de Destino</Label>
                  <Select value={editForm.sectorId} onValueChange={(v) => setEditForm({...editForm, sectorId: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input value={editForm.responsible} onChange={e => setEditForm({...editForm, responsible: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Input value={editForm.reason} onChange={e => setEditForm({...editForm, reason: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleEditSubmit} disabled={updateVisit.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </AppLayout>
  );
}

