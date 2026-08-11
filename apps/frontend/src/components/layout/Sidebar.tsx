import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, ClipboardList, FileBarChart, Headphones, LayoutDashboard, LogOut, Monitor, Settings, Shield, Tag, UserCog, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const navClass = "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors";

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const active = (path: string) => location === path || location.startsWith(`${path}/`);
  const item = (path: string, label: string, Icon: typeof Building2, exact = false) => (
    <Link href={path} className={cn(navClass, (exact ? location === path : active(path)) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground")}>
      <Icon className="w-4 h-4" /><span>{label}</span>
    </Link>
  );

  return (
    <div className="w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-[100dvh] sticky top-0 text-sidebar-foreground">
      <div className="h-16 flex items-center px-4 gap-3 border-b border-sidebar-border">
        <div className="bg-sidebar-primary text-sidebar-primary-foreground p-1.5 rounded-md"><Building2 className="w-5 h-5" /></div>
        <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-sidebar-foreground/70 tracking-wider leading-none mb-0.5">Prefeitura Municipal</span><span className="font-semibold text-sm leading-none">Paraíba do Sul</span></div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {user?.role === 'attendant' ? item('/service-center', 'Central de Atendimento', Headphones) : <>
          {item('/dashboard', 'Dashboard', LayoutDashboard)}
          {item('/visits/new', 'Nova Visita', UserPlus)}
          {item('/visits', 'Visitas', ClipboardList, true)}
          {item('/visitors', 'Visitantes', Users)}
          {item('/reports', 'Relatórios', FileBarChart)}
          <a href="/call-display" target="_blank" rel="noreferrer" className={cn(navClass, "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground")}><Monitor className="w-4 h-4" /><span>Visor de Chamadas</span></a>
          {user?.role === 'admin' && <>
            <div className="pt-4 pb-2 px-3"><span className="text-xs font-semibold text-sidebar-foreground/50 tracking-wider">ADMINISTRATIVO</span></div>
            {item('/sectors', 'Setores', Building2)}
            {item('/users', 'Usuários', UserCog)}
            <div className="pt-2 pb-1 px-3"><span className="text-[10px] font-semibold text-sidebar-foreground/40 tracking-wider uppercase">Configurações</span></div>
            {item('/config/fields', 'Campos do Formulário', Settings)}
            {item('/config/label', 'Etiqueta de Visita', Tag)}
            {item('/audit', 'Auditoria', Shield)}
          </>}
        </>}
      </nav>

      <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
        <div className="flex items-center gap-3 mb-4"><Avatar className="w-9 h-9 border border-sidebar-border"><AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">{user?.name.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="flex flex-col min-w-0 flex-1"><span className="text-sm font-medium truncate" title={user?.name}>{user?.name}</span><span className="text-[11px] text-sidebar-foreground/60 uppercase tracking-wide">{user?.role === 'admin' ? 'Administrador' : user?.role === 'attendant' ? 'Atendente' : 'Recepcionista'}</span></div></div>
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/80 hover:text-destructive hover:bg-destructive/10" onClick={logout}><LogOut className="w-4 h-4 mr-2" />Sair do Sistema</Button>
      </div>
    </div>
  );
}
