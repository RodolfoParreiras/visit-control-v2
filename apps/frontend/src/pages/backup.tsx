import { useState } from "react";
import { useGenerateBackup } from "@visit-control/api-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  DatabaseBackup,
  Download,
  HardDrive,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type LastBackup = {
  filename: string;
  size: number;
  generatedAt: Date;
};

function filenameTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${value("year")}${value("month")}${value("day")}_${value("hour")}${value("minute")}${value("second")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Backup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const generateBackup = useGenerateBackup();
  const [lastBackup, setLastBackup] = useState<LastBackup | null>(null);

  const handleGenerateBackup = () => {
    generateBackup.mutate(undefined, {
      onSuccess: (backup) => {
        const generatedAt = new Date();
        const filename = `visit_control_${filenameTimestamp(generatedAt)}.sql.gz`;
        const downloadUrl = URL.createObjectURL(backup);
        const anchor = document.createElement("a");

        anchor.href = downloadUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);

        setLastBackup({ filename, size: backup.size, generatedAt });
        toast({ title: "Backup gerado e baixado com sucesso" });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Não foi possível gerar o backup",
          description:
            error?.data?.error ??
            "Verifique a configuração do servidor e tente novamente.",
        });
      },
    });
  };

  return (
    <AppLayout>
      <div className="page-container">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="page-title">
              <DatabaseBackup className="h-8 w-8" />
              Backup do Sistema
            </h1>
            <p className="mt-1 text-slate-500">
              Gere uma cópia completa e segura dos dados da aplicação.
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-lg text-[#012c61]">
                <HardDrive className="h-5 w-5 text-slate-500" />
                Gerar backup completo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <p>
                  O arquivo inclui visitantes, visitas, usuários, setores,
                  configurações, filas de atendimento e registros de auditoria.
                </p>
                <p>
                  A geração utiliza uma fotografia consistente do banco e não
                  interrompe o atendimento. O arquivo temporário é removido do
                  servidor após o download.
                </p>
              </div>

              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">Arquivo confidencial</p>
                  <p className="mt-1 text-sm text-amber-800">
                    O backup contém dados pessoais e credenciais protegidas.
                    Armazene-o em local seguro e restrito.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleGenerateBackup}
                disabled={generateBackup.isPending}
                className="h-11 gap-2 rounded-lg border-0 bg-[#012c61] px-6 font-semibold text-white hover:bg-[#01244f]"
              >
                <Download className="h-4 w-4" />
                {generateBackup.isPending
                  ? "Gerando backup..."
                  : "Gerar e baixar backup"}
              </Button>
            </CardContent>
          </Card>

          <Card className="h-fit overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-lg text-[#012c61]">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
                Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6 text-sm text-slate-600">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>Acesso exclusivo para administradores.</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>Arquivo compactado no formato SQL.</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>Geração registrada na auditoria do sistema.</span>
              </div>

              {lastBackup && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="font-semibold text-[#012c61]">
                    Último backup desta sessão
                  </p>
                  <p className="mt-2 break-all text-xs">
                    {lastBackup.filename}
                  </p>
                  <p className="mt-1 text-xs">
                    {formatFileSize(lastBackup.size)} ·{" "}
                    {format(lastBackup.generatedAt, "HH:mm:ss")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
