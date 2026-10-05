import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';

// As atualizações em tempo real ficam no RealtimeProvider, montado uma única vez
// no App: aqui a conexão era recriada a cada troca de tela.
export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Fecha a gaveta do menu ao trocar de tela.
  useEffect(() => setMenuOpen(false), [location]);

  return (
    <div className="flex min-h-[100dvh] w-full bg-background no-print">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Em telas menores o menu lateral vira uma gaveta aberta por este cabeçalho. */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-sidebar px-4 text-white shadow-sm lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <span className="truncate text-sm font-semibold">Controle de Visitantes</span>
        </header>
        {children}
      </main>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-64 max-w-[85vw] border-0 p-0 sm:max-w-[85vw] [&>button]:text-white">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>
    </div>
  );
}
