import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { canUseServiceCenter } from '@/lib/permissions';
import { serviceApi, type CurrentService } from '@/lib/service-api';

type ExitGuardContextType = {
  /** Sai do sistema, avisando antes se houver um atendimento em andamento. */
  requestLogout: () => Promise<void>;
};

type DesktopWindow = Window & { __beforeAppClose?: () => Promise<boolean> };

const ExitGuardContext = createContext<ExitGuardContextType | undefined>(undefined);

/**
 * Evita que atendentes saiam do sistema (botão Sair ou fechando o app desktop)
 * deixando um atendimento em andamento, o que mantém a visita aberta.
 */
export function ExitGuardProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState<CurrentService | null>(null);
  const [finishing, setFinishing] = useState(false);
  const resolver = useRef<((canLeave: boolean) => void) | null>(null);

  const close = (canLeave: boolean) => {
    resolver.current?.(canLeave);
    resolver.current = null;
    setCurrent(null);
  };

  /** Resolve `true` quando é seguro sair; `false` se a pessoa desistiu. */
  const confirmExit = useCallback(async (): Promise<boolean> => {
    if (!user || !canUseServiceCenter(user)) return true;
    let active: CurrentService | null = null;
    try {
      active = (await serviceApi.central()).current;
    } catch {
      // Sem conseguir consultar a central, não impede a saída.
      return true;
    }
    if (!active) return true;
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setCurrent(active);
    });
  }, [user]);

  const finishAndLeave = async () => {
    if (!current) return;
    setFinishing(true);
    try {
      await serviceApi.complete(current.id);
      void queryClient.invalidateQueries();
      close(true);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Não foi possível finalizar o atendimento', description: (error as Error).message });
    } finally {
      setFinishing(false);
    }
  };

  const requestLogout = useCallback(async () => {
    if (await confirmExit()) logout();
  }, [confirmExit, logout]);

  // O app desktop pergunta à página antes de fechar a janela.
  useEffect(() => {
    const desktopWindow = window as DesktopWindow;
    desktopWindow.__beforeAppClose = confirmExit;
    return () => {
      if (desktopWindow.__beforeAppClose === confirmExit) delete desktopWindow.__beforeAppClose;
    };
  }, [confirmExit]);

  return (
    <ExitGuardContext.Provider value={{ requestLogout }}>
      {children}
      <AlertDialog open={current !== null} onOpenChange={(open) => { if (!open && !finishing) close(false); }}>
        <AlertDialogContent className="max-w-lg overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-2xl">
          <AlertDialogHeader className="space-y-4 px-6 pb-2 pt-6 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <CircleAlert className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <AlertDialogTitle className="text-xl font-semibold text-[#012c61]">
                Você tem um atendimento em andamento
              </AlertDialogTitle>
              <AlertDialogDescription className="leading-6 text-slate-600">
                <strong className="text-slate-800">{current?.visitorName}</strong>
                {current?.deskName ? ` está sendo atendido(a) na ${current.deskName}.` : ' está sendo atendido(a).'}{' '}
                Se você sair sem finalizar, a visita continuará aberta e a saída não será registrada.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end sm:space-x-0">
            <Button variant="ghost" onClick={() => close(false)} disabled={finishing}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={() => close(true)} disabled={finishing}>
              Sair sem finalizar
            </Button>
            <Button className="bg-[#012c61] text-white hover:bg-[#01244f]" onClick={finishAndLeave} disabled={finishing}>
              {finishing ? 'Finalizando...' : 'Finalizar e sair'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ExitGuardContext.Provider>
  );
}

export function useExitGuard() {
  const context = useContext(ExitGuardContext);
  if (!context) throw new Error('useExitGuard must be used within an ExitGuardProvider');
  return context;
}
