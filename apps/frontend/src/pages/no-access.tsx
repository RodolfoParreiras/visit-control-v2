import { ShieldOff } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function NoAccess() {
  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl p-6 md:p-8">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <ShieldOff className="h-10 w-10 text-slate-400" />
            <h1 className="text-xl font-semibold text-[#012c61]">Nenhuma tela liberada</h1>
            <p className="max-w-md text-slate-500">
              Seu usuário ainda não possui permissões de acesso ao sistema. Procure um administrador para liberar as telas de que você precisa.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
