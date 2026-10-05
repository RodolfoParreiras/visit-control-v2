import { useEffect, useRef } from 'react';

const EVENTS_URL = '/api/service/display/events';
// O servidor envia "ping" a cada 20 s; sem nenhuma mensagem por 50 s a conexão
// é considerada morta (rede caiu sem aviso, Windows suspenso, proxy derrubou).
const SILENCE_LIMIT_MS = 50_000;
const MAX_RETRY_DELAY_MS = 30_000;

// Diagnóstico: localStorage.setItem('realtime-debug', '1') e recarregar a tela.
const debug = (...args: unknown[]) => {
  try {
    if (localStorage.getItem('realtime-debug')) console.info('[tempo-real]', new Date().toLocaleTimeString('pt-BR'), ...args);
  } catch {
    // localStorage indisponível: sem diagnóstico.
  }
};

export type RealtimeHandlers = {
  /** Disparado a cada evento nomeado recebido do servidor. */
  onEvent?: (event: string, data: unknown) => void;
  /**
   * Disparado quando a conexão é restabelecida após uma queda. Eventos do
   * intervalo podem ter sido perdidos, então os dados devem ser recarregados.
   */
  onResync?: () => void;
};

const EVENT_NAMES = ['update', 'call', 'queue-entry'] as const;

/**
 * Mantém uma conexão SSE com o servidor que se recupera sozinha. O EventSource
 * nativo desiste de vez quando recebe um erro HTTP (ex.: 502 durante uma
 * atualização do servidor) e não percebe conexões que morreram em silêncio.
 */
export function useServiceEvents(handlers: RealtimeHandlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let watchdog: number | undefined;
    let retryDelay = 2_000;
    let lastMessageAt = Date.now();
    let hasConnected = false;
    let stopped = false;

    const touch = () => { lastMessageAt = Date.now(); };

    const scheduleReconnect = () => {
      if (stopped || retryTimer !== undefined) return;
      debug(`reconectando em ${retryDelay / 1000}s`);
      source?.close();
      source = null;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
    };

    const connect = () => {
      if (stopped) return;
      touch();
      const events = new EventSource(EVENTS_URL);
      source = events;

      events.addEventListener('connected', () => {
        touch();
        debug(hasConnected ? 'reconectado; recarregando dados' : 'conectado');
        retryDelay = 2_000;
        if (hasConnected) handlersRef.current.onResync?.();
        hasConnected = true;
      });
      events.addEventListener('ping', touch);
      for (const name of EVENT_NAMES) {
        events.addEventListener(name, (event) => {
          touch();
          let data: unknown = null;
          try { data = JSON.parse((event as MessageEvent).data); } catch { /* evento sem dados */ }
          handlersRef.current.onEvent?.(name, data);
        });
      }
      events.onerror = () => {
        debug(`erro na conexão (estado ${events.readyState})`);
        // CLOSED = o navegador desistiu (erro HTTP); reconectamos manualmente.
        if (events.readyState === EventSource.CLOSED) scheduleReconnect();
      };
    };

    // Detecta conexões que continuam "abertas" mas não recebem mais nada.
    watchdog = window.setInterval(() => {
      if (source && Date.now() - lastMessageAt > SILENCE_LIMIT_MS) {
        debug('sem mensagens há mais de 50s; conexão considerada morta');
        scheduleReconnect();
      }
    }, 10_000);

    // Ao voltar a rede ou a janela, confere a conexão imediatamente.
    const recheck = () => {
      if (document.visibilityState === 'hidden') return;
      if (!source || source.readyState === EventSource.CLOSED || Date.now() - lastMessageAt > SILENCE_LIMIT_MS) {
        retryDelay = 2_000;
        if (retryTimer !== undefined) { window.clearTimeout(retryTimer); retryTimer = undefined; }
        scheduleReconnect();
      }
    };
    window.addEventListener('online', recheck);
    document.addEventListener('visibilitychange', recheck);

    connect();

    return () => {
      stopped = true;
      source?.close();
      window.clearTimeout(retryTimer);
      window.clearInterval(watchdog);
      window.removeEventListener('online', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [enabled]);
}
