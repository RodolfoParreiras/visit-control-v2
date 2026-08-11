import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { serviceApi, type DisplayCall } from '@/lib/service-api';

const displayKey = ['service-display'];
const label = (call: DisplayCall) => call.deskName ?? 'Chamada geral';

export default function CallDisplay() {
  const [now, setNow] = useState(new Date());
  const [sound, setSound] = useState(true);
  const lastSpoken = useRef<number | null>(null);
  const { data, refetch } = useQuery({ queryKey: displayKey, queryFn: serviceApi.display, refetchInterval: 15000 });

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const events = new EventSource('/api/service/display/events');
    events.addEventListener('call', () => refetch());
    return () => { clearInterval(clock); events.close(); };
  }, [refetch]);

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
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-slate-950 text-white px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xl font-semibold"><Building2 />Prefeitura Municipal de Paraíba do Sul</div>
        <div className="flex items-center gap-5"><strong className="text-3xl">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong><Button variant="ghost" className="text-white hover:text-white hover:bg-white/10" onClick={() => setSound((value) => !value)}>{sound ? <Volume2 className="mr-2" /> : <VolumeX className="mr-2" />}{sound ? 'Som ativado' : 'Som desativado'}</Button></div>
      </header>
      <main className="p-8 md:p-12 max-w-7xl mx-auto space-y-8">
        {data?.current ? <section className="rounded-3xl bg-white shadow-lg border p-10 md:p-14 text-center"><p className="font-bold tracking-widest text-primary text-2xl">CHAMADA ATUAL</p><h1 className="mt-6 text-5xl md:text-7xl font-black uppercase">{data.current.visitorName}</h1><p className="mt-6 text-3xl text-slate-600">Setor: <strong>{data.current.sectorName}</strong></p><div className="mt-8 rounded-2xl bg-primary text-primary-foreground p-8 text-4xl md:text-6xl font-black uppercase">{data.current.deskName ?? 'DIRIJA-SE AO SETOR'}</div></section> : <section className="rounded-3xl bg-white shadow border p-20 text-center text-3xl text-slate-500">Aguardando a próxima chamada</section>}
        <section><h2 className="text-2xl font-bold mb-4">Últimas chamadas</h2><div className="rounded-2xl bg-white border shadow-sm overflow-hidden">{data?.recent.length ? data.recent.map((call) => <div key={call.id} className="grid grid-cols-[1fr_1fr_auto] gap-4 px-7 py-5 border-b last:border-b-0 text-xl"><strong>{call.visitorName}</strong><span>{call.sectorName}</span><span className="font-semibold text-primary">{label(call)}</span></div>) : <div className="p-8 text-center text-muted-foreground">Ainda não há chamadas anteriores.</div>}</div></section>
      </main>
    </div>
  );
}
