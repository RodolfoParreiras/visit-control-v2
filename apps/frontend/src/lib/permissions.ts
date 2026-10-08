import type { User, UserPermissions } from '@visit-control/api-client';

export type PermissionKey = keyof UserPermissions;
type Role = User['role'];

/** Permissões agrupadas como aparecem no cadastro de usuários. */
export const permissionGroups: { title: string; items: { key: PermissionKey; label: string }[] }[] = [
  {
    title: 'Visitas',
    items: [
      { key: 'viewVisits', label: 'Consultar visitas' },
      { key: 'registerVisit', label: 'Registrar entrada' },
      { key: 'checkoutVisit', label: 'Registrar saída' },
      { key: 'reprintLabel', label: 'Imprimir etiqueta' },
      { key: 'editVisit', label: 'Editar visitas' },
      { key: 'cancelVisit', label: 'Cancelar visitas' },
    ],
  },
  {
    title: 'Visitantes',
    items: [
      { key: 'viewVisitors', label: 'Consultar visitantes' },
      { key: 'createVisitor', label: 'Cadastrar visitantes' },
      { key: 'editVisitorName', label: 'Editar nome' },
      { key: 'editVisitorCpf', label: 'Editar CPF' },
      { key: 'editVisitorBirthDate', label: 'Editar data de nascimento' },
      { key: 'editVisitorPhone', label: 'Editar telefone' },
      { key: 'editVisitorCompany', label: 'Editar empresa/órgão' },
      { key: 'editVisitorCity', label: 'Editar cidade' },
    ],
  },
  {
    title: 'Atendimento',
    items: [
      { key: 'accessServiceCenter', label: 'Acessar a Central de Atendimento' },
      { key: 'viewCallDisplay', label: 'Abrir o visor de chamadas' },
    ],
  },
  {
    title: 'Painel e relatórios',
    items: [
      { key: 'viewDashboard', label: 'Ver dashboard' },
      { key: 'viewDashboardCharts', label: 'Ver gráficos do dashboard' },
      { key: 'viewReports', label: 'Gerar relatórios' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { key: 'manageSectors', label: 'Gerenciar setores e mesas' },
      { key: 'manageSettings', label: 'Configurar formulário e etiqueta' },
      { key: 'viewAudit', label: 'Consultar auditoria' },
    ],
  },
];

const permissionKeys = permissionGroups.flatMap((group) => group.items.map((item) => item.key));

const allowOnly = (keys: PermissionKey[]) =>
  Object.fromEntries(permissionKeys.map((key) => [key, keys.includes(key)])) as unknown as UserPermissions;

/** Mesmos padrões aplicados pelo backend ao criar um usuário com cada perfil. */
export function defaultPermissionsForRole(role: Role): UserPermissions {
  if (role === 'admin') return allowOnly(permissionKeys);
  if (role === 'attendant') return allowOnly(['accessServiceCenter']);
  return allowOnly([
    'viewDashboard',
    'viewVisits',
    'registerVisit',
    'checkoutVisit',
    'reprintLabel',
    'viewVisitors',
    'createVisitor',
    'editVisitorName',
    'editVisitorCpf',
    'editVisitorBirthDate',
    'editVisitorPhone',
    'editVisitorCompany',
    'editVisitorCity',
    'viewReports',
    'viewCallDisplay',
  ]);
}

/** Verdadeiro se o usuário tiver ao menos uma das permissões (administradores sempre têm). */
export function can(user: User | null | undefined, ...keys: PermissionKey[]): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return keys.some((key) => Boolean(user.permissions?.[key]));
}

/** Acesso à central exige a permissão e um setor vinculado. */
export function canUseServiceCenter(user: User | null | undefined): boolean {
  return can(user, 'accessServiceCenter') && Boolean(user?.sectorId);
}

/** Primeira tela que o usuário pode abrir após o login. */
export function homePath(user: User): string {
  if (can(user, 'viewDashboard')) return '/dashboard';
  if (can(user, 'viewVisits')) return '/visits';
  if (can(user, 'registerVisit')) return '/visits/new';
  if (canUseServiceCenter(user)) return '/service-center';
  if (can(user, 'viewVisitors')) return '/visitors';
  if (can(user, 'viewReports')) return '/reports';
  if (can(user, 'manageSectors')) return '/sectors';
  if (can(user, 'manageSettings')) return '/config/fields';
  if (can(user, 'viewAudit')) return '/audit';
  if (can(user, 'viewCallDisplay')) return '/call-display';
  return '/no-access';
}
