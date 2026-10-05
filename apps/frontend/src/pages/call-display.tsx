import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { serviceApi, type DisplayCall } from '@/lib/service-api';
import { useServiceEvents } from '@/lib/realtime';

const displayKey = ['service-display'];
const label = (call: DisplayCall) => call.deskName ?? 'Chamada geral';

export default function CallDisplay() {
  const [now, setNow] = useState(new Date());
  const [sound, setSound] = useState(true);
  const lastSpoken = useRef<number | null>(null);
  const { data, refetch } = useQuery({ queryKey: displayKey, queryFn: serviceApi.display, refetchInterval: 15000 });

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // O visor fica aberto o dia todo: a conexão se recupera sozinha de quedas.
  useServiceEvents({
    onEvent: (event) => { if (event === 'call') void refetch(); },
    onResync: () => void refetch(),
  });

  useEffect(() => {
    const call = data?.current;
    if (!sound || !call || call.id === lastSpoken.current || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const destination = call.deskName ? `, ${call.deskName}` : '';
    const message = new SpeechSynthesisUtterance(`${call.visitorName}, dirigir-se ao setor ${call.sectorName}${destination}.`);
    message.lang = 'pt-BR';
    message.onstart = () => { lastSpoken.current = call.id; };
    window.speechSynthesis.speak(message);
  }, [data?.current, sound]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-950">
      <header className="flex min-h-24 items-center justify-between gap-6 bg-[#012c61] px-6 py-4 text-white shadow-sm md:px-10">
        <div className="flex items-center gap-4">
          <div
            role="img"
            aria-label="Brasão da Prefeitura de Paraíba do Sul"
            className="h-14 w-14 shrink-0 bg-white"
            style={{
              WebkitMaskImage: "url('/brasao.png')",
              maskImage: "url('/brasao.png')",
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
            }}
          />
          <div className="border-l border-white/25 pl-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b2d233]">Prefeitura Municipal de Paraíba do Sul</p>
            <p className="mt-1 text-lg font-semibold leading-none md:text-xl">Controle de Visitantes</p>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3">
            <Clock3 className="h-7 w-7" />
            <strong className="text-2xl tabular-nums md:text-3xl">
              {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </strong>
          </div>
          <div className="hidden h-10 w-px bg-white/30 sm:block" />
          <Button
            variant="ghost"
            aria-pressed={sound}
            className="h-11 rounded-lg border border-white/25 px-3 text-white hover:bg-white/10 hover:text-white md:px-5"
            onClick={() => setSound((value) => !value)}
          >
            {sound ? <Volume2 className="mr-2 h-5 w-5" /> : <VolumeX className="mr-2 h-5 w-5" />}
            <span className="hidden sm:inline">{sound ? 'Som ativado' : 'Som desativado'}</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 p-6 md:p-8 lg:py-9">
        {data?.current ? (
          <section className="overflow-hidden rounded-3xl border border-t-4 border-slate-200 border-t-[#b2d233] bg-white px-7 py-8 text-center shadow-lg shadow-[#012c61]/10 md:px-12 md:py-9">
            <p className="text-lg font-bold tracking-[0.28em] text-[#012c61] md:text-xl">CHAMADA ATUAL</p>
            <h1
              key={data.current.id}
              className="call-display-visitor-blink mt-3 break-words text-5xl font-black uppercase leading-none text-[#012c61] md:text-7xl"
            >
              {data.current.visitorName}
            </h1>
            <div className="mt-4 flex items-baseline justify-center gap-3 text-2xl md:text-3xl">
              <span className="text-slate-500">Setor</span>
              <strong className="text-[#012c61]">{data.current.sectorName}</strong>
            </div>
            <div className="mt-6 rounded-2xl bg-[#012c61] px-6 py-5 text-4xl font-black uppercase text-white md:text-6xl">
              {data.current.deskName ?? 'DIRIJA-SE AO SETOR'}
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-t-4 border-slate-200 border-t-[#b2d233] bg-white p-16 text-center text-2xl font-semibold text-slate-500 shadow-lg shadow-[#012c61]/10 md:p-20 md:text-3xl">
            Aguardando a próxima chamada
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#174f8c]/10 text-[#012c61]">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#012c61] md:text-2xl">Últimas chamadas</h2>
              <p className="text-sm text-slate-500">Chamadas recentes</p>
            </div>
          </div>

          <div className="grid grid-cols-[1.3fr_1fr_auto] gap-4 bg-slate-50 px-6 py-3 text-sm font-semibold text-[#012c61] md:grid-cols-[1.2fr_1fr_180px] md:text-base">
            <span>Visitante</span>
            <span>Setor</span>
            <span>Destino</span>
          </div>
          {data?.recent.length ? (
            data.recent.map((call) => (
              <div key={call.id} className="grid grid-cols-[1.3fr_1fr_auto] gap-4 border-t border-slate-100 px-6 py-3.5 text-base md:grid-cols-[1.2fr_1fr_180px] md:text-lg">
                <strong className="break-words leading-tight">{call.visitorName}</strong>
                <span className="truncate" title={call.sectorName}>{call.sectorName}</span>
                <span className="font-semibold text-[#012c61]">{label(call)}</span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">Ainda não há chamadas anteriores.</div>
          )}
        </section>
      </main>
    </div>
  );
}
