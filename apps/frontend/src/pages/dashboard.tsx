import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  useGetDashboardStats, 
  useGetVisitsBySector, 
  useGetWeeklyChart, 
  useGetMonthlyChart,
  useGetRecentVisits 
} from '@visit-control/api-client';
import { 
  Users, 
  ArrowRightToLine, 
  ArrowLeftFromLine, 
  CalendarDays, 
  CalendarRange,
  Activity,
  Building2,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sectorChart } = useGetVisitsBySector({ query: { enabled: isAdmin } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: weeklyChart } = useGetWeeklyChart({ query: { enabled: isAdmin } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: monthlyChart } = useGetMonthlyChart({ query: { enabled: isAdmin } as any });
  const { data: recentVisits } = useGetRecentVisits({ limit: 5 });

  const StatCard = ({ title, value, icon: Icon, subtitle, colorClass }: any) => (
    <Card className="overflow-hidden">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold tracking-tight">{value !== undefined ? value : '-'}</h3>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-4 rounded-xl ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 mt-1">Visão geral do sistema de controle de visitantes.</p>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard 
            title="Presentes Agora" 
            value={stats?.currentlyPresent} 
            icon={Activity} 
            colorClass="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
            subtitle="Visitantes no prédio"
          />
          <StatCard 
            title="Entradas Hoje" 
            value={stats?.todayTotal} 
            icon={ArrowRightToLine} 
            colorClass="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
          />
          <StatCard 
            title="Saídas Hoje" 
            value={stats?.todayExits} 
            icon={ArrowLeftFromLine} 
            colorClass="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" 
          />
          {isAdmin && (
            <>
              <StatCard 
                title="Total na Semana" 
                value={stats?.weekTotal} 
                icon={CalendarDays} 
                colorClass="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" 
              />
              <StatCard 
                title="Total no Mês" 
                value={stats?.monthTotal} 
                icon={CalendarRange} 
                colorClass="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" 
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAIN CHARTS - ADMIN ONLY */}
          {isAdmin && (
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                    Visitas por Setor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    {sectorChart && sectorChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sectorChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="sectorName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                          <Tooltip 
                            cursor={{ fill: '#f3f4f6' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                          />
                          <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados suficientes</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Evolução Semanal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px] w-full">
                      {weeklyChart && weeklyChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={weeklyChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--color-primary)", strokeWidth: 2, stroke: "#fff" }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Evolução Mensal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px] w-full">
                      {monthlyChart && monthlyChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="total" fill="var(--color-primary)" radius={[2, 2, 0, 0]} opacity={0.8} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* RECENT VISITS - ALL ROLES */}
          <Card className={`flex flex-col ${isAdmin ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5 text-muted-foreground" />
                Últimos Registros
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                {recentVisits?.map(visit => (
                  <div key={visit.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {visit.visitor?.name?.substring(0, 2).toUpperCase() || '??'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {visit.visitor?.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        {visit.sector?.name}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs font-mono text-gray-500">
                          {visit.entryTime}
                        </div>
                        <StatusBadge status={visit.status} />
                      </div>
                    </div>
                  </div>
                ))}

                {(!recentVisits || recentVisits.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhum registro recente encontrado.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
