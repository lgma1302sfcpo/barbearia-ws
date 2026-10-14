'use client';

import { useState, type SyntheticEvent } from 'react';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PinGate({
  checking,
  onUnlock,
}: {
  checking: boolean;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState(''),
    [error, setError] = useState(''),
    [submitting, setSubmitting] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || 'PIN incorreto.');
        setPin('');
        return;
      }
      onUnlock();
    } catch {
      setError('Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#172b36] px-4">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#fffdf9] p-7 shadow-2xl">
        <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-[#f2a24a] text-[#172b36]">
          <LockKeyhole className="size-6" />
        </span>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a45113]">
          Área protegida
        </p>
        <h1 className="mt-1 text-2xl font-black text-[#172b36]">
          Controle de repasses
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Digite o PIN para abrir o sistema da barbearia.
        </p>
        {checking ? (
          <div className="mt-7 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Verificando
            acesso...
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-3">
            <label htmlFor="access-pin" className="grid gap-1.5 text-xs font-bold text-muted-foreground">
              <span>PIN</span>
              <Input
                id="access-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={8}
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, ''))
                }
                placeholder="••••"
                className="h-12 text-center text-xl font-black tracking-[.45em]"
                required
              />
            </label>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={submitting || pin.length < 4}
              className="mt-1 h-11 bg-[#f2a24a] font-bold text-[#172b36] hover:bg-[#ffb65f]"
            >
              {submitting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <LockKeyhole />
              )}{' '}
              Entrar
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}

