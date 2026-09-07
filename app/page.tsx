'use client';

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Banknote,
  Beer,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  Scissors,
  Trash2,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';

type Appointment = {
  id: number;
  date: string;
  professional: 'Flávio' | 'Fernando';
  payment: string;
  service: string;
  client: string;
  amount_cents: number;
  time: string;
};
type Product = { id: number; name: string; price_cents: number; stock: number };
type BeverageSale = {
  id: number;
  date: string;
  product_id: number;
  product_name: string;
  client: string;
  quantity: number;
  unit_price_cents: number;
};
type Expense = {
  id: number;
  date: string;
  description: string;
  category: string;
  payment: string;
  amount_cents: number;
};
type MonthlyCut = {
  id: number;
  month: string;
  professional: 'Flávio' | 'Fernando';
  payment: string;
  client: string;
  amount_cents: number;
  cuts_total: number;
  cuts_used: number;
  start_date: string;
  last_cut_date: string;
  time: string;
};
type DataSet = {
  appointments: Appointment[];
  products: Product[];
  beverageSales: BeverageSale[];
  expenses: Expense[];
  monthlyCuts: MonthlyCut[];
};
type Section = 'atendimentos' | 'mensais' | 'bebidas' | 'gastos' | 'resumo';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const monthLabel = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const emptyData: DataSet = {
  appointments: [],
  products: [],
  beverageSales: [],
  expenses: [],
  monthlyCuts: [],
};
const today = new Date().toLocaleDateString('en-CA');
const SERVICE_OPTIONS = [
  { name: 'Corte', cents: 4000 },
  { name: 'Corte + barba', cents: 7000 },
  { name: 'Barba', cents: 4000 },
  { name: 'Corte + pigmentação', cents: 6500 },
  { name: 'Corte + alisante', cents: 6500 },
  { name: 'Corte + luzes', cents: 8000 },
  { name: 'Corte + platinado', cents: 14000 },
  { name: 'Pezinho', cents: 1500 },
  { name: 'Sobrancelha', cents: 700 },
] as const;
const toCents = (value: string) =>
  Math.round((Number(value.replace(',', '.')) || 0) * 100);
const displayDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
const expectedServicePrice = (service: string) =>
  SERVICE_OPTIONS.find(
    (item) =>
      item.name.toLocaleLowerCase('pt-BR') ===
      service.trim().toLocaleLowerCase('pt-BR'),
  )?.cents ?? null;
const hasPaymentOrPriceIssue = (item: Appointment) =>
  item.payment === 'Não pagou' ||
  (expectedServicePrice(item.service) !== null &&
    item.amount_cents !== expectedServicePrice(item.service));

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [section, setSection] = useState<Section>('atendimentos');
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [data, setData] = useState<DataSet>(emptyData);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [recentlyAddedId, setRecentlyAddedId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/data?month=${month}`);
        if (response.status === 401) {
          setAuthenticated(false);
          return;
        }
        if (!response.ok)
          throw new Error('Não foi possível carregar os lançamentos.');
        const payload = (await response.json()) as DataSet;
        setData(payload);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Erro ao carregar os dados.',
        );
      } finally {
        setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    void fetch('/api/auth')
      .then(
        async (response) =>
          (await response.json()) as { authenticated?: boolean },
      )
      .then((result) => setAuthenticated(Boolean(result.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);
  useEffect(() => {
    if (authenticated) void refresh(false);
  }, [authenticated, refresh]);

  const dayAppointments = data.appointments.filter(
    (item) => item.date === selectedDate,
  );
  const daySales = data.beverageSales.filter(
    (item) => item.date === selectedDate,
  );
  const dayExpenses = data.expenses.filter(
    (item) => item.date === selectedDate,
  );
  const totals = useMemo(() => {
    const flavio = dayAppointments
      .filter((item) => item.professional === 'Flávio')
      .reduce((sum, item) => sum + item.amount_cents, 0);
    const fernando = dayAppointments
      .filter((item) => item.professional === 'Fernando')
      .reduce((sum, item) => sum + item.amount_cents, 0);
    const drinks = daySales.reduce(
      (sum, item) => sum + item.quantity * item.unit_price_cents,
      0,
    );
    const expenses = dayExpenses.reduce(
      (sum, item) => sum + item.amount_cents,
      0,
    );
    return { flavio, fernando, services: flavio + fernando, drinks, expenses };
  }, [dayAppointments, daySales, dayExpenses]);

  const monthly = useMemo(() => {
    const flavio = data.appointments
      .filter((item) => item.professional === 'Flávio')
      .reduce((sum, item) => sum + item.amount_cents, 0);
    const fernando = data.appointments
      .filter((item) => item.professional === 'Fernando')
      .reduce((sum, item) => sum + item.amount_cents, 0);
    const drinks = data.beverageSales.reduce(
      (sum, item) => sum + item.quantity * item.unit_price_cents,
      0,
    );
    const expenses = data.expenses.reduce(
      (sum, item) => sum + item.amount_cents,
      0,
    );
    return { flavio, fernando, services: flavio + fernando, drinks, expenses };
  }, [data]);

  function changeMonth(offset: number) {
    const value = new Date(`${month}-15T12:00:00Z`);
    value.setUTCMonth(value.getUTCMonth() + offset);
    const next = value.toISOString().slice(0, 7);
    setMonth(next);
    setSelectedDate(`${next}-01`);
  }

  function openEntryForm() {
    const scrollY = window.scrollY;
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    setSection('atendimentos');
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        if (isMobile)
          document
            .getElementById('entry-form')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo({ top: scrollY, behavior: 'auto' });
      }),
    );
  }

  async function save(
    payload: Record<string, unknown>,
    success: string,
    method: 'POST' | 'PATCH' = 'POST',
  ) {
    setError('');
    try {
      const scrollY = window.scrollY;
      const shouldRevealAppointment =
        method === 'POST' && payload.entity === 'appointment';
      const response = await fetch('/api/data', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { id?: number; error?: string };
      if (response.status === 401) {
        setAuthenticated(false);
        return false;
      }
      if (!response.ok) {
        setError(result.error || 'Não foi possível salvar.');
        return false;
      }
      if (method === 'POST' && payload.entity === 'appointment' && result.id) {
        setRecentlyAddedId(Number(result.id));
        window.setTimeout(() => setRecentlyAddedId(null), 3200);
      }
      setNotice(success);
      window.setTimeout(() => setNotice(''), 2600);
      await refresh(true);
      if (!shouldRevealAppointment)
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() =>
            window.scrollTo({ top: scrollY, behavior: 'auto' }),
          ),
        );
      return true;
    } catch {
      setError(
        'Não foi possível salvar. Verifique a conexão e tente novamente.',
      );
      return false;
    }
  }

  async function remove(entity: string, id: number) {
    if (
      !window.confirm(
        'Excluir este lançamento? Esta ação não pode ser desfeita.',
      )
    )
      return;
    const response = await fetch(`/api/data?entity=${entity}&id=${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setError('Não foi possível excluir o lançamento.');
      return;
    }
    await refresh(true);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      setData(emptyData);
      setAuthenticated(false);
    } finally {
      setLoggingOut(false);
    }
  }

  function exportCsv() {
    const rows = [
      ['Data', 'Profissional', 'Pagamento', 'Serviço', 'Cliente', 'Valor'],
      ...data.appointments.map((item) => [
        item.date,
        item.professional,
        item.payment,
        item.service,
        item.client,
        (item.amount_cents / 100).toFixed(2).replace('.', ','),
      ]),
    ];
    const csv =
      '\ufeff' +
      rows
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
            .join(';'),
        )
        .join('\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `atendimentos-${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'create_appointment',
          title: 'Adicionar atendimento',
          description:
            'Registra um atendimento de Flávio ou Fernando e atualiza os repasses de 60% e 40%.',
          inputSchema: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: 'Data no formato AAAA-MM-DD',
              },
              professional: { type: 'string', enum: ['Flávio', 'Fernando'] },
              payment: { type: 'string' },
              service: { type: 'string' },
              client: { type: 'string' },
              amount: { type: 'number', minimum: 0.01 },
              time: { type: 'string', description: 'Horário HH:MM' },
            },
            required: [
              'date',
              'professional',
              'payment',
              'service',
              'amount',
              'time',
            ],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const item = input as Record<string, unknown>;
            const response = await fetch('/api/data', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                entity: 'appointment',
                ...item,
                amountCents: Math.round(Number(item.amount) * 100),
              }),
            });
            const result = (await response.json()) as Record<string, unknown>;
            if (!response.ok)
              throw new Error(
                String(result.error || 'Não foi possível salvar.'),
              );
            setMonth(String(item.date).slice(0, 7));
            setSelectedDate(String(item.date));
            setSection('atendimentos');
            await refresh();
            return {
              id: result.id,
              saved: true,
              professional: item.professional,
              amount: item.amount,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [refresh]);

  if (authenticated !== true)
    return (
      <PinGate
        checking={authenticated === null}
        onUnlock={() => {
          setAuthenticated(true);
          setLoading(true);
        }}
      />
    );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="z-20 border-b border-white/10 bg-[#172b36] text-white shadow-sm sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#f2a24a] text-[#172b36]">
              <Scissors className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/55">
                Controle da barbearia
              </p>
              <h1 className="text-lg font-bold tracking-tight">
                Resumo de repasses
              </h1>
            </div>
          </div>
          <nav
            className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto"
            aria-label="Seções"
          >
            <Nav
              active={section === 'atendimentos'}
              onClick={() => setSection('atendimentos')}
              icon={<Scissors />}
            >
              Atendimentos
            </Nav>
            <Nav
              active={section === 'mensais'}
              onClick={() => setSection('mensais')}
              icon={<CalendarRange />}
            >
              Cortes mensais
            </Nav>
            <Nav
              active={section === 'bebidas'}
              onClick={() => setSection('bebidas')}
              icon={<Beer />}
            >
              Bebidas
            </Nav>
            <Nav
              active={section === 'gastos'}
              onClick={() => setSection('gastos')}
              icon={<ReceiptText />}
            >
              Gastos
            </Nav>
            <Nav
              active={section === 'resumo'}
              onClick={() => setSection('resumo')}
              icon={<CircleDollarSign />}
            >
              Resumo mensal
            </Nav>
          </nav>
          <div className="order-2 flex gap-2 sm:order-3">
            <Button
              variant="ghost"
              className="h-9 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => void logout()}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <LogOut />
              )}
              {loggingOut ? 'Bloqueando...' : 'Bloquear'}
            </Button>
            <Button
              className="h-9 bg-[#f2a24a] px-3 font-bold text-[#172b36] hover:bg-[#ffb65f]"
              onClick={openEntryForm}
            >
              <Plus /> Lançar
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-8">
        <section className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">
              Visão do mês
            </p>
            <h2 className="font-heading text-3xl font-bold tracking-tight capitalize">
              {monthLabel.format(new Date(`${month}-01T12:00:00Z`))}
            </h2>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button variant="outline" onClick={exportCsv}>
              <Download /> Exportar CSV
            </Button>
            <div className="flex w-full min-w-0 items-center gap-1 rounded-xl border bg-card p-1 shadow-sm sm:w-auto">
              <Button
                className="shrink-0"
                variant="ghost"
                size="icon"
                onClick={() => changeMonth(-1)}
                disabled={loading}
                aria-label="Mês anterior"
              >
                {loading ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ChevronLeft />
                )}
              </Button>
              <Input
                className="mobile-date-input h-10 min-w-0 flex-1 basis-0 border-0 text-center text-base font-semibold shadow-none focus-visible:ring-0 sm:h-8 sm:w-[150px] sm:flex-none sm:text-sm"
                type="date"
                value={selectedDate}
                disabled={loading}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setMonth(e.target.value.slice(0, 7));
                }}
              />
              <Button
                className="shrink-0"
                variant="ghost"
                size="icon"
                onClick={() => changeMonth(1)}
                disabled={loading}
                aria-label="Próximo mês"
              >
                {loading ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ChevronRight />
                )}
              </Button>
            </div>
          </div>
        </section>

        {notice && (
          <div className="fixed right-4 top-20 z-40 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg sm:right-8">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <section
          className="relative mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-busy={loading}
        >
          {loading && (
            <div className="absolute inset-0 z-10 grid gap-3 bg-background sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"
                >
                  <Skeleton className="size-9 rounded-xl" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-8 w-2/3" />
                </div>
              ))}
            </div>
          )}
          <Summary
            icon={<CircleDollarSign />}
            label="Faturamento bruto do dia"
            value={money.format(totals.services / 100)}
            highlight
          />
          <Summary
            icon={<Users />}
            label="Clientes atendidos"
            value={String(dayAppointments.length)}
          />
          <ProfessionalSplitSummary
            flavio={totals.flavio}
            fernando={totals.fernando}
          />
          <Summary
            icon={<Banknote />}
            label="Barbearia · 40% dos dois"
            value={money.format((totals.services * 0.4) / 100)}
          />
        </section>

        {loading ? (
          <DashboardSkeleton />
        ) : section === 'atendimentos' ? (
          <Appointments
            items={dayAppointments}
            totals={totals}
            selectedDate={selectedDate}
            save={save}
            remove={remove}
            monthly={monthly}
            recentlyAddedId={recentlyAddedId}
          />
        ) : section === 'mensais' ? (
          <MonthlyCuts
            items={data.monthlyCuts}
            month={month}
            selectedDate={selectedDate}
            save={save}
            remove={remove}
          />
        ) : section === 'bebidas' ? (
          <Beverages
            products={data.products}
            sales={daySales}
            selectedDate={selectedDate}
            post={(payload, success) => save(payload, success)}
            remove={remove}
          />
        ) : section === 'gastos' ? (
          <Expenses
            items={dayExpenses}
            selectedDate={selectedDate}
            post={(payload, success) => save(payload, success)}
            remove={remove}
          />
        ) : (
          <Monthly data={data} totals={monthly} />
        )}
      </div>
    </main>
  );
}

function PinGate({
  checking,
  onUnlock,
}: {
  checking: boolean;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState(''),
    [error, setError] = useState(''),
    [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
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
            <Field label="PIN">
              <Input
                autoFocus
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
            </Field>
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

function Appointments({
  items,
  totals,
  selectedDate,
  save,
  remove,
  monthly,
  recentlyAddedId,
}: {
  items: Appointment[];
  totals: ReturnType<typeof dayTotals>;
  selectedDate: string;
  save: (
    payload: Record<string, unknown>,
    success: string,
    method?: 'POST' | 'PATCH',
  ) => Promise<boolean>;
  remove: (entity: string, id: number) => Promise<void>;
  monthly: ReturnType<typeof monthTotals>;
  recentlyAddedId: number | null;
}) {
  const [professional, setProfessional] = useState<'' | 'Flávio' | 'Fernando'>(
      '',
    ),
    [payment, setPayment] = useState(''),
    [service, setService] = useState(''),
    [client, setClient] = useState('Cliente'),
    [amount, setAmount] = useState(''),
    [time, setTime] = useState(
      new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    ),
    [editingId, setEditingId] = useState<number | null>(null),
    [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!recentlyAddedId) return;
    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.recently-added')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      });
    });
    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [items, recentlyAddedId]);
  function resetForm() {
    setEditingId(null);
    setProfessional('');
    setPayment('');
    setService('');
    setClient('Cliente');
    setAmount('');
  }
  function edit(item: Appointment) {
    setEditingId(item.id);
    setProfessional(item.professional);
    setPayment(item.payment);
    setService(item.service);
    setClient(item.client);
    setAmount(String(item.amount_cents / 100).replace('.', ','));
    setTime(item.time);
  }
  function selectService(value: string) {
    setService(value);
    const selected = SERVICE_OPTIONS.find((item) => item.name === value);
    setAmount(selected ? String(selected.cents / 100).replace('.', ',') : '');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const payload = {
      entity: 'appointment',
      id: editingId ?? undefined,
      date: selectedDate,
      professional,
      payment,
      service,
      client,
      amountCents: toCents(amount),
      time,
    };
    try {
      const saved = await save(
        payload,
        editingId ? 'Atendimento atualizado.' : 'Atendimento adicionado.',
        editingId ? 'PATCH' : 'POST',
      );
      if (saved) resetForm();
    } finally {
      setSubmitting(false);
    }
  }
  const flavioItems = items.filter((item) => item.professional === 'Flávio');
  const fernandoItems = items.filter(
    (item) => item.professional === 'Fernando',
  );
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="professional-carousel">
          <ProfessionalPanel
            name="Flávio"
            date={selectedDate}
            items={flavioItems}
            total={totals.flavio}
            remove={remove}
            edit={edit}
            recentlyAddedId={recentlyAddedId}
          />
          <ProfessionalPanel
            name="Fernando"
            date={selectedDate}
            items={fernandoItems}
            total={totals.fernando}
            remove={remove}
            edit={edit}
            recentlyAddedId={recentlyAddedId}
          />
        </div>
        <form
          id="entry-form"
          onSubmit={submit}
          className="form-card entry-form !gap-2.5 !p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <FormTitle
              title={editingId ? 'Editar atendimento' : 'Novo atendimento'}
              text={
                editingId
                  ? 'Altere os dados e salve.'
                  : 'O lançamento aparece no lado correto.'
              }
            />
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={resetForm}
                aria-label="Cancelar edição"
              >
                <X />
              </Button>
            )}
          </div>
          <Field label="Profissional">
            <NativeSelect
              className="w-full"
              value={professional}
              onChange={(e) =>
                setProfessional(e.target.value as '' | 'Flávio' | 'Fernando')
              }
              required
            >
              <NativeSelectOption value="" disabled>
                Selecione uma opção
              </NativeSelectOption>
              <NativeSelectOption>Flávio</NativeSelectOption>
              <NativeSelectOption>Fernando</NativeSelectOption>
            </NativeSelect>
          </Field>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            <Field label="Serviço">
              <NativeSelect
                className="w-full"
                value={service}
                onChange={(e) => selectService(e.target.value)}
                required
              >
                <NativeSelectOption value="" disabled>
                  Selecione uma opção
                </NativeSelectOption>
                {service && expectedServicePrice(service) === null && (
                  <NativeSelectOption value={service}>
                    {service} (antigo)
                  </NativeSelectOption>
                )}
                {SERVICE_OPTIONS.map((item) => (
                  <NativeSelectOption key={item.name} value={item.name}>
                    {item.name} · {money.format(item.cents / 100)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Cliente">
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Pagamento">
              <Payment value={payment} onChange={setPayment} />
            </Field>
            <Field label="Horário">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Valor">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Split cents={toCents(amount)} />
          <Submit loading={submitting}>
            {editingId ? 'Salvar alterações' : 'Adicionar atendimento'}
          </Submit>
        </form>
      </div>
      <ProfessionalCard daily={totals} monthly={monthly} />
    </div>
  );
}

function ProfessionalPanel({
  name,
  date,
  items,
  total,
  remove,
  edit,
  recentlyAddedId,
}: {
  name: 'Flávio' | 'Fernando';
  date: string;
  items: Appointment[];
  total: number;
  remove: (entity: string, id: number) => Promise<void>;
  edit: (item: Appointment) => void;
  recentlyAddedId: number | null;
}) {
  const flavio = name === 'Flávio';
  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${flavio ? 'border-[#8fc8b9]' : 'border-[#b6b9dd]'}`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${flavio ? 'bg-[#e7f3ef]' : 'bg-[#eeeefa]'}`}
      >
        <div>
          <p
            className={`text-[11px] font-bold uppercase tracking-[.14em] ${flavio ? 'text-[#397567]' : 'text-[#565b91]'}`}
          >
            Lado {name}
          </p>
          <h3 className="text-lg font-black">{name}</h3>
          <p className="text-xs text-muted-foreground">
            {displayDate(date)} · {items.length} atendimentos
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-muted-foreground">
            Total do dia
          </p>
          <p className="text-lg font-black tabular-nums">
            {money.format(total / 100)}
          </p>
        </div>
      </div>
      {items.length ? (
        <table className="professional-table">
          <thead>
            <tr>
              <th>Serviço / cliente</th>
              <th>Pgto. / hora</th>
              <th className="text-right">Valor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`${item.id === recentlyAddedId ? 'recently-added' : ''} ${hasPaymentOrPriceIssue(item) ? 'payment-issue' : ''}`}
              >
                <td>
                  <strong>{item.service}</strong>
                  <small>{item.client}</small>
                  {expectedServicePrice(item.service) !== null &&
                    item.amount_cents !==
                      expectedServicePrice(item.service) && (
                      <small className="issue-note">
                        Esperado:{' '}
                        {money.format(
                          expectedServicePrice(item.service)! / 100,
                        )}
                      </small>
                    )}
                </td>
                <td>
                  <strong
                    className={`!font-medium ${item.payment === 'Não pagou' ? 'issue-note' : ''}`}
                  >
                    {item.payment}
                  </strong>
                  <small>{item.time}</small>
                </td>
                <td
                  className={`text-right font-bold ${expectedServicePrice(item.service) !== null && item.amount_cents !== expectedServicePrice(item.service) ? 'issue-note' : 'text-foreground'}`}
                >
                  {money.format(item.amount_cents / 100)}
                </td>
                <td>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-[#b45f16]"
                      onClick={() => edit(item)}
                      aria-label="Editar atendimento"
                    >
                      <Pencil />
                    </Button>
                    <Delete onClick={() => remove('appointment', item.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty text={`Nenhum atendimento de ${name} neste dia.`} />
      )}
    </section>
  );
}

function MonthlyCuts({
  items,
  month,
  selectedDate,
  save,
  remove,
}: {
  items: MonthlyCut[];
  month: string;
  selectedDate: string;
  save: (
    payload: Record<string, unknown>,
    success: string,
    method?: 'POST' | 'PATCH',
  ) => Promise<boolean>;
  remove: (entity: string, id: number) => Promise<void>;
}) {
  const [professional, setProfessional] = useState<'' | 'Flávio' | 'Fernando'>(
      '',
    ),
    [client, setClient] = useState(''),
    [payment, setPayment] = useState(''),
    [amount, setAmount] = useState(''),
    [cutsTotal, setCutsTotal] = useState('4'),
    [cutsUsed, setCutsUsed] = useState('1'),
    [startDate, setStartDate] = useState(selectedDate),
    [lastCutDate, setLastCutDate] = useState(selectedDate),
    [time, setTime] = useState(
      new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    ),
    [editingId, setEditingId] = useState<number | null>(null),
    [submitting, setSubmitting] = useState(false);

  const totalCuts = items.reduce((sum, item) => sum + item.cuts_total, 0);
  const usedCuts = items.reduce((sum, item) => sum + item.cuts_used, 0);
  const received = items
    .filter((item) => item.payment !== 'Não pagou')
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const flavioReceived = items
    .filter(
      (item) => item.professional === 'Flávio' && item.payment !== 'Não pagou',
    )
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const fernandoReceived = items
    .filter(
      (item) =>
        item.professional === 'Fernando' && item.payment !== 'Não pagou',
    )
    .reduce((sum, item) => sum + item.amount_cents, 0);

  function resetForm() {
    setEditingId(null);
    setProfessional('');
    setClient('');
    setPayment('');
    setAmount('');
    setCutsTotal('4');
    setCutsUsed('1');
    setStartDate(selectedDate);
    setLastCutDate(selectedDate);
  }

  function edit(item: MonthlyCut) {
    setEditingId(item.id);
    setProfessional(item.professional);
    setClient(item.client);
    setPayment(item.payment);
    setAmount(String(item.amount_cents / 100).replace('.', ','));
    setCutsTotal(String(item.cuts_total));
    setCutsUsed(String(item.cuts_used));
    setStartDate(item.start_date);
    setLastCutDate(item.last_cut_date);
    setTime(item.time);
    document.getElementById('monthly-cut-form')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const submittedProfessional = String(
      form.get('professional') || professional,
    ).trim();
    const submittedClient = String(form.get('client') || client).trim();
    const submittedPayment = String(form.get('payment') || payment).trim();
    const submittedStartDate = String(
      form.get('startDate') || startDate || selectedDate || `${month}-01`,
    );
    setSubmitting(true);
    try {
      const saved = await save(
        {
          entity: 'monthlyCut',
          id: editingId ?? undefined,
          month: /^\d{4}-\d{2}$/.test(month)
            ? month
            : submittedStartDate.slice(0, 7),
          professional: submittedProfessional,
          client: submittedClient,
          payment: submittedPayment,
          amountCents: toCents(String(form.get('amount') ?? amount)),
          cutsTotal: Number(form.get('cutsTotal') ?? cutsTotal),
          cutsUsed: Number(form.get('cutsUsed') ?? cutsUsed),
          startDate: submittedStartDate,
          lastCutDate,
          time: String(form.get('time') || time),
        },
        editingId ? 'Plano mensal atualizado.' : 'Plano mensal adicionado.',
        editingId ? 'PATCH' : 'POST',
      );
      if (saved) resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MonthlyMetric label="Clientes mensais" value={String(items.length)} />
        <MonthlyMetric
          label="Cortes realizados"
          value={`${usedCuts} de ${totalCuts}`}
        />
        <MonthlyMetric
          label="Cortes restantes"
          value={String(Math.max(0, totalCuts - usedCuts))}
        />
        <MonthlyMetric
          label="Valor recebido"
          value={money.format(received / 100)}
        />
        <MonthlyMetric
          label="Flávio · 60%"
          value={money.format((flavioReceived * 0.6) / 100)}
        />
        <MonthlyMetric
          label="Fernando · 60%"
          value={money.format((fernandoReceived * 0.6) / 100)}
        />
        <MonthlyMetric
          label="Barbearia · 40%"
          value={money.format((received * 0.4) / 100)}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="monthly-professional-carousel">
          <MonthlyCutProfessionalPanel
            name="Flávio"
            items={items.filter((item) => item.professional === 'Flávio')}
            selectedDate={selectedDate}
            save={save}
            remove={remove}
            edit={edit}
          />
          <MonthlyCutProfessionalPanel
            name="Fernando"
            items={items.filter((item) => item.professional === 'Fernando')}
            selectedDate={selectedDate}
            save={save}
            remove={remove}
            edit={edit}
          />
        </div>
        <div className="hidden">
          <DataCard
            title="Cortes mensais"
            subtitle="Acompanhamento dos planos e do uso de cada corte"
            count={items.length}
          >
            {items.length ? (
              <table className="data-table monthly-cuts-table">
                <thead>
                  <tr>
                    <th>Profissional / cliente</th>
                    <th>Plano / progresso</th>
                    <th>Pagamento</th>
                    <th>Valor</th>
                    <th>Último corte</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const complete = item.cuts_used >= item.cuts_total;
                    const pending =
                      item.payment === 'Não pagou' || item.amount_cents === 0;
                    return (
                      <tr
                        key={item.id}
                        className={pending ? 'monthly-payment-pending' : ''}
                      >
                        <td>
                          <strong>{item.professional}</strong>
                          <small>{item.client}</small>
                        </td>
                        <td>
                          <strong>
                            Corte mensal {item.cuts_used}/{item.cuts_total}
                          </strong>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${complete ? 'bg-emerald-600' : 'bg-[#f2a24a]'}`}
                              style={{
                                width: `${Math.min(100, (item.cuts_used / item.cuts_total) * 100)}%`,
                              }}
                            />
                          </div>
                          <small>
                            {complete
                              ? 'Plano concluído'
                              : `${item.cuts_total - item.cuts_used} restantes`}
                          </small>
                        </td>
                        <td className={pending ? 'issue-note' : ''}>
                          {item.payment}
                        </td>
                        <td
                          className={`font-bold ${pending ? 'issue-note' : ''}`}
                        >
                          {money.format(item.amount_cents / 100)}
                        </td>
                        <td>
                          <strong>{displayDate(item.last_cut_date)}</strong>
                          <small>{item.time}</small>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <MonthlyCutUseButton
                              item={item}
                              disabled={complete}
                              onUse={() =>
                                save(
                                  {
                                    entity: 'monthlyCutUse',
                                    id: item.id,
                                    date: selectedDate,
                                    time: new Date().toLocaleTimeString(
                                      'pt-BR',
                                      {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      },
                                    ),
                                  },
                                  `Corte ${item.cuts_used + 1}/${item.cuts_total} registrado para ${item.client}.`,
                                  'PATCH',
                                )
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => edit(item)}
                              aria-label={`Editar plano de ${item.client}`}
                            >
                              <Pencil />
                            </Button>
                            <Delete
                              onClick={() => remove('monthlyCut', item.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Empty text="Nenhum corte mensal cadastrado neste mês." />
            )}
          </DataCard>
        </div>

        <form
          id="monthly-cut-form"
          className="form-card entry-form"
          onSubmit={submit}
        >
          <div className="flex items-start justify-between gap-3">
            <FormTitle
              title={editingId ? 'Editar plano mensal' : 'Novo plano mensal'}
              text="Cadastre o pagamento e acompanhe os cortes usados."
            />
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={resetForm}
                aria-label="Cancelar edição"
              >
                <X />
              </Button>
            )}
          </div>
          <Field label="Profissional">
            <NativeSelect
              className="w-full"
              name="professional"
              value={professional}
              onChange={(event) =>
                setProfessional(
                  event.target.value as '' | 'Flávio' | 'Fernando',
                )
              }
              required
            >
              <NativeSelectOption value="" disabled>
                Selecione uma opção
              </NativeSelectOption>
              <NativeSelectOption>Flávio</NativeSelectOption>
              <NativeSelectOption>Fernando</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Cliente">
            <Input
              name="client"
              value={client}
              onChange={(event) => setClient(event.target.value)}
              required
            />
          </Field>
          <Field label="Pagamento">
            <Payment name="payment" value={payment} onChange={setPayment} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor do plano">
              <Input
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0,00"
              />
            </Field>
            <Field label="Total de cortes">
              <Input
                name="cutsTotal"
                type="number"
                min="1"
                max="31"
                value={cutsTotal}
                onChange={(event) => setCutsTotal(event.target.value)}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cortes usados">
              <Input
                name="cutsUsed"
                type="number"
                min="0"
                max={Math.max(1, Number(cutsTotal) || 1)}
                value={cutsUsed}
                onChange={(event) => setCutsUsed(event.target.value)}
                required
              />
            </Field>
            <Field label="Horário">
              <Input
                name="time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Data de início">
            <Input
              name="startDate"
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                if (!editingId) setLastCutDate(event.target.value);
              }}
              required
            />
          </Field>
          <Submit loading={submitting}>
            {editingId ? 'Salvar alterações' : 'Adicionar plano mensal'}
          </Submit>
        </form>
      </div>
    </div>
  );
}

function MonthlyCutProfessionalPanel({
  name,
  items,
  selectedDate,
  save,
  remove,
  edit,
}: {
  name: 'Flávio' | 'Fernando';
  items: MonthlyCut[];
  selectedDate: string;
  save: (
    payload: Record<string, unknown>,
    success: string,
    method?: 'POST' | 'PATCH',
  ) => Promise<boolean>;
  remove: (entity: string, id: number) => Promise<void>;
  edit: (item: MonthlyCut) => void;
}) {
  const flavio = name === 'Flávio';
  const received = items
    .filter((item) => item.payment !== 'Não pagou')
    .reduce((sum, item) => sum + item.amount_cents, 0);
  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${flavio ? 'border-[#8fc8b9]' : 'border-[#b6b9dd]'}`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${flavio ? 'bg-[#e7f3ef]' : 'bg-[#eeeefa]'}`}
      >
        <div>
          <p
            className={`text-[11px] font-bold uppercase tracking-[.14em] ${flavio ? 'text-[#397567]' : 'text-[#565b91]'}`}
          >
            Cortes mensais
          </p>
          <h3 className="text-lg font-black">{name}</h3>
          <p className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? 'cliente' : 'clientes'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-muted-foreground">
            Recebido
          </p>
          <p className="text-lg font-black tabular-nums">
            {money.format(received / 100)}
          </p>
        </div>
      </div>
      {items.length ? (
        <div className="divide-y">
          {items.map((item) => {
            const complete = item.cuts_used >= item.cuts_total;
            const pending =
              item.payment === 'Não pagou' || item.amount_cents === 0;
            return (
              <article
                key={item.id}
                className={`p-4 ${pending ? 'monthly-payment-pending' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-base">
                      {item.client}
                    </strong>
                    <span
                      className={`mt-1 block text-xs font-bold ${pending ? 'text-red-700' : 'text-muted-foreground'}`}
                    >
                      {item.payment} · {money.format(item.amount_cents / 100)}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${complete ? 'bg-emerald-100 text-emerald-800' : 'bg-[#fff0d5] text-[#9a4d13]'}`}
                  >
                    {item.cuts_used}/{item.cuts_total}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-600' : 'bg-[#f2a24a]'}`}
                    style={{
                      width: `${Math.min(100, (item.cuts_used / item.cuts_total) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Último corte: {displayDate(item.last_cut_date)} às{' '}
                    {item.time}
                  </p>
                  <div className="flex items-center gap-1">
                    <MonthlyCutUseButton
                      item={item}
                      disabled={complete}
                      onUse={() =>
                        save(
                          {
                            entity: 'monthlyCutUse',
                            id: item.id,
                            date: selectedDate,
                            time: new Date().toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }),
                          },
                          `Corte ${item.cuts_used + 1}/${item.cuts_total} registrado para ${item.client}.`,
                          'PATCH',
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => edit(item)}
                      aria-label={`Editar plano de ${item.client}`}
                    >
                      <Pencil />
                    </Button>
                    <Delete onClick={() => remove('monthlyCut', item.id)} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty text={`Nenhum plano mensal de ${name} neste mês.`} />
      )}
    </section>
  );
}

function MonthlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
    </article>
  );
}

function MonthlyCutUseButton({
  item,
  disabled,
  onUse,
}: {
  item: MonthlyCut;
  disabled: boolean;
  onUse: () => Promise<boolean>;
}) {
  const [loading, setLoading] = useState(false);
  async function handleUseCut() {
    setLoading(true);
    try {
      await onUse();
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled || loading}
      onClick={() => void handleUseCut()}
      aria-label={
        disabled
          ? `Plano de ${item.client} concluído`
          : `Registrar próximo corte de ${item.client}`
      }
    >
      {loading ? <LoaderCircle className="animate-spin" /> : <Plus />}
      {disabled ? 'Concluído' : 'Corte'}
    </Button>
  );
}

function Beverages({
  products,
  sales,
  selectedDate,
  post,
  remove,
}: {
  products: Product[];
  sales: BeverageSale[];
  selectedDate: string;
  post: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  remove: (entity: string, id: number) => Promise<void>;
}) {
  const [productId, setProductId] = useState(''),
    [quantity, setQuantity] = useState('1'),
    [client, setClient] = useState('Cliente'),
    [name, setName] = useState(''),
    [price, setPrice] = useState('6'),
    [stock, setStock] = useState('0'),
    [selling, setSelling] = useState(false),
    [creatingProduct, setCreatingProduct] = useState(false);
  async function sale(event: FormEvent) {
    event.preventDefault();
    setSelling(true);
    try {
      if (
        await post(
          {
            entity: 'beverageSale',
            date: selectedDate,
            productId: Number(productId),
            quantity: Number(quantity),
            client,
          },
          'Venda de bebida adicionada.',
        )
      ) {
        setProductId('');
        setQuantity('1');
      }
    } finally {
      setSelling(false);
    }
  }
  async function product(event: FormEvent) {
    event.preventDefault();
    setCreatingProduct(true);
    try {
      if (
        await post(
          {
            entity: 'product',
            name,
            priceCents: toCents(price),
            stock: Number(stock),
          },
          'Bebida cadastrada.',
        )
      ) {
        setName('');
        setStock('0');
      }
    } finally {
      setCreatingProduct(false);
    }
  }
  const total = sales.reduce(
    (sum, item) => sum + item.quantity * item.unit_price_cents,
    0,
  );
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <DataCard
          title={`Bebidas de ${displayDate(selectedDate)}`}
          subtitle={`Total vendido: ${money.format(total / 100)}`}
          count={sales.reduce((sum, item) => sum + item.quantity, 0)}
        >
          {sales.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bebida</th>
                  <th>Cliente</th>
                  <th>Quantidade</th>
                  <th className="text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sales.map((item) => (
                  <tr key={item.id}>
                    <td className="font-bold">{item.product_name}</td>
                    <td>{item.client}</td>
                    <td>{item.quantity}</td>
                    <td className="text-right font-bold">
                      {money.format(
                        (item.quantity * item.unit_price_cents) / 100,
                      )}
                    </td>
                    <td className="w-10">
                      <Delete onClick={() => remove('beverageSale', item.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text="Nenhuma bebida vendida neste dia." />
          )}
        </DataCard>
        <DataCard
          title="Estoque atual"
          subtitle="Preço e saldo disponíveis"
          count={products.length}
        >
          {products.length ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border bg-muted/25 p-4"
                >
                  <div className="flex justify-between gap-2">
                    <strong>{item.name}</strong>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.stock < 5 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}
                    >
                      {item.stock} un.
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {money.format(item.price_cents / 100)}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="Cadastre a primeira bebida ao lado." />
          )}
        </DataCard>
      </div>
      <aside className="space-y-5">
        <form id="entry-form" className="form-card" onSubmit={sale}>
          <FormTitle
            title="Vender bebida"
            text="O preço entra automaticamente."
          />
          <Field label="Bebida">
            <NativeSelect
              className="w-full"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            >
              <NativeSelectOption value="" disabled>
                Selecione uma opção
              </NativeSelectOption>
              {products.map((item) => (
                <NativeSelectOption key={item.id} value={String(item.id)}>
                  {item.name} · {item.stock} un.
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade">
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="Cliente">
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </Field>
          </div>
          <Submit disabled={!products.length} loading={selling}>
            Registrar venda
          </Submit>
        </form>
        <form className="form-card" onSubmit={product}>
          <FormTitle
            title="Cadastrar bebida"
            text="Defina preço e estoque inicial."
          />
          <Field label="Nome">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Heineken"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço">
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <Field label="Estoque">
              <Input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </Field>
          </div>
          <Submit loading={creatingProduct}>Cadastrar bebida</Submit>
        </form>
      </aside>
    </div>
  );
}

function Expenses({
  items,
  selectedDate,
  post,
  remove,
}: {
  items: Expense[];
  selectedDate: string;
  post: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  remove: (entity: string, id: number) => Promise<void>;
}) {
  const [description, setDescription] = useState(''),
    [category, setCategory] = useState(''),
    [payment, setPayment] = useState(''),
    [amount, setAmount] = useState(''),
    [submitting, setSubmitting] = useState(false);
  const total = items.reduce((sum, item) => sum + item.amount_cents, 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (
        await post(
          {
            entity: 'expense',
            date: selectedDate,
            description,
            category,
            payment,
            amountCents: toCents(amount),
          },
          'Gasto adicionado.',
        )
      ) {
        setDescription('');
        setCategory('');
        setPayment('');
        setAmount('');
      }
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <DataCard
        title={`Gastos de ${displayDate(selectedDate)}`}
        subtitle={`Total do dia: ${money.format(total / 100)}`}
        count={items.length}
      >
        {items.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Pagamento</th>
                <th className="text-right">Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-bold">{item.description}</td>
                  <td>{item.category}</td>
                  <td>{item.payment}</td>
                  <td className="text-right font-bold">
                    {money.format(item.amount_cents / 100)}
                  </td>
                  <td className="w-10">
                    <Delete onClick={() => remove('expense', item.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="Nenhum gasto lançado neste dia." />
        )}
      </DataCard>
      <form id="entry-form" className="form-card" onSubmit={submit}>
        <FormTitle title="Novo gasto" text="Registre as saídas da barbearia." />
        <Field label="Descrição">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Produtos de limpeza"
            required
          />
        </Field>
        <Field label="Categoria">
          <NativeSelect
            className="w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <NativeSelectOption value="" disabled>
              Selecione uma opção
            </NativeSelectOption>
            <NativeSelectOption>Material</NativeSelectOption>
            <NativeSelectOption>Manutenção</NativeSelectOption>
            <NativeSelectOption>Aluguel</NativeSelectOption>
            <NativeSelectOption>Contas</NativeSelectOption>
            <NativeSelectOption>Outros</NativeSelectOption>
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pagamento">
            <Payment value={payment} onChange={setPayment} />
          </Field>
          <Field label="Valor">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
        </div>
        <Submit loading={submitting}>Adicionar gasto</Submit>
      </form>
    </div>
  );
}

function Monthly({
  data,
  totals,
}: {
  data: DataSet;
  totals: ReturnType<typeof monthTotals>;
}) {
  const days = Array.from(
    new Set([
      ...data.appointments.map((x) => x.date),
      ...data.beverageSales.map((x) => x.date),
      ...data.expenses.map((x) => x.date),
    ]),
  )
    .sort()
    .reverse();
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <DataCard
        title="Fechamento por dia"
        subtitle="Serviços, bebidas e gastos no mês"
        count={days.length}
      >
        {days.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th className="text-right">Flávio</th>
                <th className="text-right">Fernando</th>
                <th className="text-right">Bebidas</th>
                <th className="text-right">Gastos</th>
                <th className="text-right">40% barbearia</th>
              </tr>
            </thead>
            <tbody>
              {days.map((date) => {
                const appointments = data.appointments.filter(
                  (x) => x.date === date,
                );
                const flavio = appointments
                  .filter((x) => x.professional === 'Flávio')
                  .reduce((s, x) => s + x.amount_cents, 0);
                const fernando = appointments
                  .filter((x) => x.professional === 'Fernando')
                  .reduce((s, x) => s + x.amount_cents, 0);
                const drinks = data.beverageSales
                  .filter((x) => x.date === date)
                  .reduce((s, x) => s + x.quantity * x.unit_price_cents, 0);
                const expenses = data.expenses
                  .filter((x) => x.date === date)
                  .reduce((s, x) => s + x.amount_cents, 0);
                return (
                  <tr key={date}>
                    <td className="font-bold">{displayDate(date)}</td>
                    <td className="text-right">{money.format(flavio / 100)}</td>
                    <td className="text-right">
                      {money.format(fernando / 100)}
                    </td>
                    <td className="text-right">{money.format(drinks / 100)}</td>
                    <td className="text-right text-red-700">
                      {money.format(expenses / 100)}
                    </td>
                    <td className="text-right font-bold">
                      {money.format(((flavio + fernando) * 0.4) / 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty text="Nenhum movimento neste mês." />
        )}
      </DataCard>
      <aside className="space-y-5">
        <section className="rounded-2xl bg-[#172b36] p-5 text-white shadow-sm">
          <p className="mb-5 text-xs font-bold uppercase tracking-[.14em] text-white/55">
            Fechamento do mês
          </p>
          <BigLine label="Serviços" value={totals.services} />
          <BigLine label="Bebidas" value={totals.drinks} />
          <BigLine label="Gastos" value={totals.expenses} negative />
          <div className="my-4 h-px bg-white/15" />
          <BigLine
            label="Saldo da barbearia"
            value={totals.services * 0.4 + totals.drinks - totals.expenses}
            strong
          />
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <FormTitle
            title="Repasses do mês"
            text="Mesma regra da planilha: 60% e 40%."
          />
          <PersonSummary name="Flávio" total={totals.flavio} />
          <div className="my-4 h-px bg-border" />
          <PersonSummary name="Fernando" total={totals.fernando} />
        </section>
      </aside>
    </div>
  );
}

const dayTotals = () => ({
  flavio: 0,
  fernando: 0,
  services: 0,
  drinks: 0,
  expenses: 0,
});
const monthTotals = dayTotals;
function Nav({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? 'bg-white/12 text-white' : 'text-white/55 hover:bg-white/7 hover:text-white'} [&_svg]:size-4`}
    >
      {icon}
      {children}
    </button>
  );
}
function Summary({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 shadow-sm ${highlight ? 'border-[#f2a24a]/45 bg-[#fff7ea]' : 'bg-card'}`}
    >
      <span
        className={`mb-4 grid size-9 place-items-center rounded-xl [&_svg]:size-4 ${highlight ? 'bg-[#f2a24a] text-[#172b36]' : 'bg-muted text-muted-foreground'}`}
      >
        {icon}
      </span>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight tabular-nums">
        {value}
      </p>
    </article>
  );
}
function ProfessionalSplitSummary({
  flavio,
  fernando,
}: {
  flavio: number;
  fernando: number;
}) {
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <span className="mb-3 grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-4">
        <WalletCards />
      </span>
      <p className="text-sm text-muted-foreground">Profissionais · 60%</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-[#397567]">Flávio</p>
          <p className="text-lg font-black tabular-nums">
            {money.format((flavio * 0.6) / 100)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#565b91]">Fernando</p>
          <p className="text-lg font-black tabular-nums">
            {money.format((fernando * 0.6) / 100)}
          </p>
        </div>
      </div>
    </article>
  );
}
function DataCard({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <span className="rounded-full bg-[#f2a24a]/15 px-3 py-1 text-xs font-bold text-[#a45113]">
          {count} registros
        </span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
function FormTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-1">
      <h3 className="font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
function DashboardSkeleton() {
  return (
    <section
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-label="Carregando dados"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin text-[#d47724]" />
        Carregando dados...
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="professional-carousel">
          {[0, 1].map((panel) => (
            <div
              key={panel}
              className="min-h-72 overflow-hidden rounded-2xl border bg-card shadow-sm"
            >
              <div className="space-y-2 border-b p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="space-y-4 p-4">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-4">
                    <Skeleton className="h-9 flex-1" />
                    <Skeleton className="h-9 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
          <Skeleton className="h-6 w-40" />
          {[0, 1, 2, 3, 4].map((field) => (
            <Skeleton key={field} className="h-11 w-full" />
          ))}
        </div>
      </div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Payment({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  return (
    <NativeSelect
      className="w-full"
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
    >
      <NativeSelectOption value="" disabled>
        Selecione uma opção
      </NativeSelectOption>
      <NativeSelectOption>QR/CODE</NativeSelectOption>
      <NativeSelectOption>Débito</NativeSelectOption>
      <NativeSelectOption>Crédito</NativeSelectOption>
      <NativeSelectOption>Dinheiro</NativeSelectOption>
      <NativeSelectOption>Não pagou</NativeSelectOption>
    </NativeSelect>
  );
}
function Split({ cents }: { cents: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/55 p-3 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Profissional · 60%</p>
        <p className="font-bold">{money.format((cents * 0.6) / 100)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Barbearia · 40%</p>
        <p className="font-bold">{money.format((cents * 0.4) / 100)}</p>
      </div>
    </div>
  );
}
function Submit({
  children,
  disabled = false,
  loading = false,
}: {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading}
      className="mt-1 h-11 w-full bg-[#172b36] font-bold text-white hover:bg-[#274553]"
    >
      {loading ? <LoaderCircle className="animate-spin" /> : <Plus />}
      {loading ? 'Salvando...' : children}
    </Button>
  );
}
function Delete({ onClick }: { onClick: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-red-700"
      onClick={() => void handleClick()}
      disabled={loading}
      aria-busy={loading}
      aria-label={loading ? 'Excluindo' : 'Excluir'}
    >
      {loading ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="grid min-h-44 place-items-center p-8 text-center text-sm text-muted-foreground">
      <div>
        <CalendarDays className="mx-auto mb-3 size-7 opacity-40" />
        <p>{text}</p>
      </div>
    </div>
  );
}
function ProfessionalCard({
  daily,
  monthly,
}: {
  daily: ReturnType<typeof dayTotals>;
  monthly: ReturnType<typeof monthTotals>;
}) {
  return (
    <section className="rounded-2xl bg-[#172b36] p-5 text-white shadow-sm">
      <p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-white/55">
        Repasses por profissional no dia
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white/7 p-4">
          <PersonSummary name="Flávio" total={daily.flavio} />
        </div>
        <div className="rounded-xl bg-white/7 p-4">
          <PersonSummary name="Fernando" total={daily.fernando} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 rounded-xl border border-white/10 p-3 text-xs text-white/65 sm:grid-cols-2">
        <span>Flávio no mês: {money.format(monthly.flavio / 100)}</span>
        <span>Fernando no mês: {money.format(monthly.fernando / 100)}</span>
      </div>
    </section>
  );
}
function PersonSummary({ name, total }: { name: string; total: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-bold">{name}</span>
        <span className="font-black tabular-nums">
          {money.format(total / 100)}
        </span>
      </div>
      <div className="mt-2 flex justify-between gap-2 text-xs opacity-60">
        <span>60%: {money.format((total * 0.6) / 100)}</span>
        <span>40%: {money.format((total * 0.4) / 100)}</span>
      </div>
    </div>
  );
}
function BigLine({
  label,
  value,
  negative = false,
  strong = false,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`mb-3 flex items-center justify-between gap-4 ${strong ? 'text-lg' : 'text-sm'}`}
    >
      <span className={strong ? 'font-bold' : 'text-white/60'}>{label}</span>
      <span
        className={`font-black tabular-nums ${negative ? 'text-[#ffb17a]' : ''}`}
      >
        {negative ? '− ' : ''}
        {money.format(Math.abs(value) / 100)}
      </span>
    </div>
  );
}
