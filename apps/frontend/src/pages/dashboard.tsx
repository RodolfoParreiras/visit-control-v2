import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "wouter";
import {
  useGetDashboardStats,
  useGetVisitsBySector,
  useGetWeeklyChart,
  useGetMonthlyChart,
  useGetRecentVisits,
} from "@visit-control/api-client";
import {
  Users,
  ArrowRightToLine,
  ArrowLeftFromLine,
  CalendarDays,
  CalendarRange,
  Activity,
  Building2,
  Clock,
  ChevronRight,
  CircleUserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sectorChart } = useGetVisitsBySector({
    query: { enabled: isAdmin } as any,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: weeklyChart } = useGetWeeklyChart({
    query: { enabled: isAdmin } as any,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: monthlyChart } = useGetMonthlyChart({
    query: { enabled: isAdmin } as any,
  });
  const { data: recentVisits } = useGetRecentVisits({ limit: 5 });

  const StatCard = ({
    title,
    value,
    icon: Icon,
    subtitle,
    colorClass,
  }: any) => (
    <Card className="overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex min-h-36 items-center justify-between p-5">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-600">{title}</p>
          <h3 className="text-3xl font-bold tracking-tight text-[#012c61]">
            {statsLoading ? "-" : value !== undefined ? value : "-"}
          </h3>
          {subtitle && (
            <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-xl p-3.5 ${colorClass}`}>
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </div>
      </CardContent>
    </Card>
  );

  const ReceptionistStatCard = ({
    title,
    value,
    icon: Icon,
    subtitle,
    colorClass,
  }: any) => (
    <Card className="overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex min-h-40 items-center justify-between p-7">
        <div>
          <p className="mb-2 text-base font-medium text-slate-600">{title}</p>
          <h3 className="text-4xl font-bold tracking-tight text-[#012c61]">
            {statsLoading ? "-" : value !== undefined ? value : "-"}
          </h3>
          {subtitle && (
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-xl p-4 ${colorClass}`}>
          <Icon className="h-8 w-8" strokeWidth={1.8} />
        </div>
      </CardContent>
    </Card>
  );

  const receptionistRecentVisits = (
    <Card className="overflow-hidden border-slate-200 shadow-sm lg:col-span-3">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-slate-100 px-5 py-5 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-lg text-[#012c61]">
          <Clock className="h-5 w-5 text-slate-500" />
          Últimos Registros
        </CardTitle>
        <Link
          href="/visits"
          className="hidden items-center gap-1 text-sm font-semibold text-[#174f8c] transition-colors hover:text-[#012c61] sm:flex"
        >
          Ver todas as visitas
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {recentVisits && recentVisits.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="hidden grid-cols-[1.5fr_1fr_0.75fr_0.75fr] bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
              <span>Visitante</span>
              <span>Setor</span>
              <span>Entrada</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-slate-100">
              {recentVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="grid gap-4 px-5 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[1.5fr_1fr_0.75fr_0.75fr] sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#012c61]/10 text-xs font-bold text-[#012c61]">
                      {visit.visitor?.name?.substring(0, 2).toUpperCase() ||
                        "??"}
                    </div>
                    <div className="min-w-0">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                        Visitante
                      </span>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {visit.visitor?.name}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                      Setor
                    </span>
                    <p className="flex items-center gap-1.5 truncate text-sm text-slate-600">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      {visit.sector?.name}
                    </p>
                  </div>

                  <div>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                      Entrada
                    </span>
                    <p className="text-sm font-medium text-slate-600">
                      {visit.entryTime}
                    </p>
                  </div>

                  <div className="flex flex-col items-start justify-center">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                      Status
                    </span>
                    <StatusBadge status={visit.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-20" />
            <p className="text-sm">Nenhum registro recente encontrado.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-7 p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#012c61]">
              Dashboard
            </h1>
            <p className="mt-1 text-slate-500">
              Visão geral do sistema de controle de visitantes.
            </p>
          </div>
          <div className="hidden text-right text-sm text-slate-500 sm:block">
            <div className="flex items-center justify-end gap-2 font-semibold text-slate-600">
              <span>Olá, {user?.name}</span>
              <CircleUserRound className="h-5 w-5" />
            </div>
            <div className="mt-2 flex items-center justify-end gap-2">
              <span>
                {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* STATS ROW */}
        {isAdmin ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              title="Presentes Agora"
              value={stats?.currentlyPresent}
              icon={Activity}
              colorClass="bg-blue-50 text-[#174f8c]"
              subtitle="Visitantes no prédio"
            />
            <StatCard
              title="Entradas Hoje"
              value={stats?.todayTotal}
              icon={ArrowRightToLine}
              colorClass="bg-lime-50 text-[#76ad00]"
            />
            <StatCard
              title="Saídas Hoje"
              value={stats?.todayExits}
              icon={ArrowLeftFromLine}
              colorClass="bg-red-50 text-red-600"
            />
            <StatCard
              title="Total na Semana"
              value={stats?.weekTotal}
              icon={CalendarDays}
              colorClass="bg-violet-50 text-violet-600"
            />
            <StatCard
              title="Total no Mês"
              value={stats?.monthTotal}
              icon={CalendarRange}
              colorClass="bg-indigo-50 text-indigo-600"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <ReceptionistStatCard
              title="Presentes Agora"
              value={stats?.currentlyPresent}
              icon={Activity}
              colorClass="bg-blue-50 text-[#174f8c]"
              subtitle="Visitantes no prédio"
            />
            <ReceptionistStatCard
              title="Entradas Hoje"
              value={stats?.todayTotal}
              icon={ArrowRightToLine}
              colorClass="bg-lime-50 text-[#76ad00]"
            />
            <ReceptionistStatCard
              title="Saídas Hoje"
              value={stats?.todayExits}
              icon={ArrowLeftFromLine}
              colorClass="bg-orange-50 text-orange-600"
            />
          </div>
        )}

        {isAdmin ? (
          <div className="space-y-6">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 px-6 py-5">
                <CardTitle className="flex items-center gap-2 text-lg text-[#012c61]">
                  <Building2 className="h-5 w-5 text-slate-500" />
                  Visitas por setor
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Distribuição das entradas registradas hoje.
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[300px] w-full">
                  {sectorChart && sectorChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sectorChart}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="sectorName"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          cursor={{ fill: "#f8fafc" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 10px rgba(1,44,97,0.08)",
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#174f8c"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={56}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500">
                      Sem dados suficientes
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 px-6 py-5">
                  <CardTitle className="text-base font-semibold text-[#012c61]">
                    Evolução semanal
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Semana atual · domingo a sábado
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[230px] w-full">
                    {weeklyChart && weeklyChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={weeklyChart}
                          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke="#174f8c"
                            strokeWidth={3}
                            dot={{
                              r: 4,
                              fill: "#b2d233",
                              strokeWidth: 2,
                              stroke: "#fff",
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Sem dados
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 px-6 py-5">
                  <CardTitle className="text-base font-semibold text-[#012c61]">
                    Evolução mensal
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Mês atual · primeiro ao último dia
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[230px] w-full">
                    {monthlyChart && monthlyChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={monthlyChart}
                          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="total"
                            fill="#174f8c"
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Sem dados
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {receptionistRecentVisits}
          </div>
        ) : (
          receptionistRecentVisits
        )}
      </div>
    </AppLayout>
  );
}
