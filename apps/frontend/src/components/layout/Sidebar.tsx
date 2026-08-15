import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2,
  ClipboardList,
  DatabaseBackup,
  FileBarChart,
  Headphones,
  LayoutDashboard,
  LogOut,
  Monitor,
  Settings,
  Shield,
  Tag,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navClass =
  "relative flex min-h-11 items-center gap-3 rounded-xl border-l-4 border-transparent px-4 py-2.5 text-sm font-semibold transition-all duration-200";

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const active = (path: string) =>
    location === path || location.startsWith(`${path}/`);
  const item = (
    path: string,
    label: string,
    Icon: typeof Building2,
    exact = false,
  ) => {
    const isActive = exact ? location === path : active(path);
    return (
      <Link
        href={path}
        className={cn(
          navClass,
          isActive
            ? "border-l-[#b2d233] bg-sidebar-accent text-white shadow-sm"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/55 hover:text-white",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="sticky top-0 flex h-[100dvh] w-64 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl shadow-[#012c61]/10">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <div
          role="img"
          aria-label="Brasão da Prefeitura de Paraíba do Sul"
          className="h-11 w-11 shrink-0 bg-white"
          style={{
            WebkitMaskImage: "url('/brasao.png')",
            maskImage: "url('/brasao.png')",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
          }}
        />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold leading-tight text-white">
            Controle de Visitantes
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
        {user?.role === "attendant" ? (
          item("/service-center", "Central de Atendimento", Headphones)
        ) : (
          <>
            {item("/dashboard", "Dashboard", LayoutDashboard)}
            {item("/visits", "Visitas", ClipboardList)}
            {item("/visitors", "Visitantes", Users)}
            {item("/reports", "Relatórios", FileBarChart)}
            <a
              href="/call-display"
              target="_blank"
              rel="noreferrer"
              className={cn(
                navClass,
                "text-sidebar-foreground/85 hover:bg-sidebar-accent/55 hover:text-white",
              )}
            >
              <Monitor className="h-[18px] w-[18px]" />
              <span>Visor de Chamadas</span>
            </a>
            {user?.role === "admin" && (
              <>
                <div className="pt-4 pb-2 px-3">
                  <span className="text-xs font-semibold text-sidebar-foreground/50 tracking-wider">
                    ADMINISTRATIVO
                  </span>
                </div>
                {item("/sectors", "Setores", Building2)}
                {item("/users", "Usuários", UserCog)}
                <div className="pt-2 pb-1 px-3">
                  <span className="text-[10px] font-semibold text-sidebar-foreground/40 tracking-wider uppercase">
                    Configurações
                  </span>
                </div>
                {item("/config/fields", "Campos do Formulário", Settings)}
                {item("/config/label", "Etiqueta de Visita", Tag)}
                {item("/backup", "Backup do Sistema", DatabaseBackup)}
                {item("/audit", "Auditoria", Shield)}
              </>
            )}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 bg-black/5 p-4">
        <div className="mb-3 flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-white/15">
            <AvatarFallback className="bg-sidebar-accent text-white">
              {user?.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium" title={user?.name}>
              {user?.name}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-sidebar-foreground/60">
              {user?.role === "admin"
                ? "Administrador"
                : user?.role === "attendant"
                  ? "Atendente"
                  : "Recepcionista"}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start border-0 text-sidebar-foreground/80 hover:bg-white/10 hover:text-white"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair do Sistema
        </Button>
      </div>
    </div>
  );
}
