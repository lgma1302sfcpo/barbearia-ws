'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, MonitorSmartphone, RefreshCw } from 'lucide-react';
import { PinGate } from '@/components/pin-gate';
import { Button } from '@/components/ui/button';

type Visitor = {
  id: string;
  device: string;
  browser: string;
  first_access: string;
  last_access: string;
};

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo',
});

export default function AccessHistory() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [currentVisitorId, setCurrentVisitorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/accesses', { cache: 'no-store' });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error('Não foi possível carregar os acessos. Tente novamente.');
      const result = await response.json() as {
        visitors: Visitor[]; currentVisitorId: string | null;
      };
      setVisitors(result.visitors);
      setCurrentVisitorId(result.currentVisitorId);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar os acessos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch('/api/auth', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result: { authenticated?: boolean }) => setAuthenticated(Boolean(result.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void fetch('/api/accesses', { method: 'POST' })
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível registrar este acesso.');
        return refresh();
      })
      .catch(() => void refresh());
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(interval);
  }, [authenticated, refresh]);

  if (!authenticated) {
    return <PinGate checking={authenticated === null} onUnlock={() => setAuthenticated(true)} />;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <MonitorSmartphone className="size-4" /> Controle de repasses
            </p>
            <h1 className="mt-1 text-2xl font-black">Últimos acessos</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Última entrada de cada navegador/dispositivo. Atualiza a cada 30 segundos.
            </p>
          </div>
          <Button variant="outline" disabled={loading} onClick={() => void refresh()}>
            {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            Atualizar
          </Button>
        </header>
        <p className="text-sm text-muted-foreground">
          Os horários seguem o fuso de São Paulo. O dispositivo é identificado pelo navegador;
          navegadores diferentes no mesmo aparelho aparecem separados. Limpar os cookies gera uma nova identificação.
        </p>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        <section aria-label="Histórico de acessos" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Visitante</th>
                  <th scope="col" className="px-4 py-3">Dispositivo</th>
                  <th scope="col" className="px-4 py-3">Navegador</th>
                  <th scope="col" className="px-4 py-3">Último acesso</th>
                  <th scope="col" className="px-4 py-3">Primeiro acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visitors.map((visitor) => (
                  <tr key={visitor.id}>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold">
                      Visitante {visitor.id.slice(0, 8)}
                      {visitor.id === currentVisitorId && (
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">Este navegador</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">{visitor.device}</td>
                    <td className="px-4 py-4">{visitor.browser}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold">{dateTime.format(new Date(visitor.last_access))}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{dateTime.format(new Date(visitor.first_access))}</td>
                  </tr>
                ))}
                {!visitors.length && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {loading ? 'Carregando acessos…' : error ? 'Histórico indisponível.' : 'Nenhum acesso registrado ainda.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
