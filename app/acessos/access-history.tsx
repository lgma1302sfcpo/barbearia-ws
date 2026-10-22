'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, MonitorSmartphone, RefreshCw } from 'lucide-react';
import { PinGate } from '@/components/pin-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Visitor = {
  id: string;
  label: string | null;
  device: string;
  browser: string;
  model: string | null;
  screen: string | null;
  location: string | null;
  ip: string | null;
  first_access: string;
  last_access: string;
};

type UserAgentData = {
  getHighEntropyValues(hints: string[]): Promise<{ model?: string; platformVersion?: string }>;
};

// o modelo e a versão real do sistema só vêm pelas Client Hints (Chrome/Edge); o Safari não informa
async function deviceHints() {
  const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  const values = await uaData?.getHighEntropyValues(['model', 'platformVersion']).catch(() => undefined);
  return { screen: `${screen.width}x${screen.height}`, model: values?.model, platformVersion: values?.platformVersion };
}

function LabelInput({ visitor, onSaved }: { visitor: Visitor; onSaved: () => void }) {
  const [value, setValue] = useState(visitor.label ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value.trim() === (visitor.label ?? '')) return;
    setSaving(true);
    try {
      const response = await fetch('/api/accesses', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: visitor.id, label: value }),
      });
      if (response.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Input
      value={value}
      maxLength={60}
      disabled={saving}
      placeholder={`Visitante ${visitor.id.slice(0, 8)}`}
      aria-label="Nome deste dispositivo"
      className="h-8 min-w-40 font-semibold"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void save()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

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
    void deviceHints()
      .then((hints) => fetch('/api/accesses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(hints),
      }))
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível registrar este acesso.');
        return refresh();
      })
      .catch(() => void refresh());
    // sem polling: uma aba esquecida aberta mantinha o banco Neon acordado o dia todo
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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
              Última entrada de cada navegador/dispositivo. Dê um nome a cada um para saber quem é quem.
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
          O modelo do iPhone é estimado pelo tamanho da tela e a cidade é aproximada pelo IP (em dados móveis pode
          aparecer a cidade da operadora).
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
                  <th scope="col" className="px-4 py-3">Local</th>
                  <th scope="col" className="px-4 py-3">Último acesso</th>
                  <th scope="col" className="px-4 py-3">Primeiro acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visitors.map((visitor) => (
                  <tr key={visitor.id}>
                    <td className="px-4 py-4">
                      <LabelInput key={visitor.label ?? ''} visitor={visitor} onSaved={() => void refresh()} />
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {visitor.id === currentVisitorId ? 'Este navegador · ' : ''}ID {visitor.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="whitespace-nowrap">{visitor.device}</span>
                      {visitor.model && <span className="block text-xs text-muted-foreground">{visitor.model}</span>}
                      {visitor.screen && (
                        <span className="block text-xs text-muted-foreground">Tela {visitor.screen.replace('x', '×')}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">{visitor.browser}</td>
                    <td className="px-4 py-4">
                      {visitor.location ?? '—'}
                      {visitor.ip && <span className="block text-xs text-muted-foreground">IP {visitor.ip}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold">{dateTime.format(new Date(visitor.last_access))}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{dateTime.format(new Date(visitor.first_access))}</td>
                  </tr>
                ))}
                {!visitors.length && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
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
