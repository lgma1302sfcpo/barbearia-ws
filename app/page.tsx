'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Beer, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Download, LoaderCircle, Pencil, Plus, ReceiptText, Scissors, Trash2, Users, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

type Appointment = { id: number; date: string; professional: 'Flávio' | 'Fernando'; payment: string; service: string; client: string; amount_cents: number; time: string };
type Product = { id: number; name: string; price_cents: number; stock: number };
type BeverageSale = { id: number; date: string; product_id: number; product_name: string; client: string; quantity: number; unit_price_cents: number };
type Expense = { id: number; date: string; description: string; category: string; payment: string; amount_cents: number };
type DataSet = { appointments: Appointment[]; products: Product[]; beverageSales: BeverageSale[]; expenses: Expense[] };
type Section = 'atendimentos' | 'bebidas' | 'gastos' | 'resumo';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const emptyData: DataSet = { appointments: [], products: [], beverageSales: [], expenses: [] };
const today = new Date().toLocaleDateString('en-CA');
const toCents = (value: string) => Math.round((Number(value.replace(',', '.')) || 0) * 100);
const displayDate = (date: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

export default function Home() {
  const [section, setSection] = useState<Section>('atendimentos');
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [data, setData] = useState<DataSet>(emptyData);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [recentlyAddedId, setRecentlyAddedId] = useState<number | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); setError('');
    try {
      const response = await fetch(`/api/data?month=${month}`);
      if (!response.ok) throw new Error('Não foi possível carregar os lançamentos.');
      const payload = await response.json() as DataSet;
      setData(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao carregar os dados.'); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { void refresh(false); }, [refresh]);

  const dayAppointments = data.appointments.filter((item) => item.date === selectedDate);
  const daySales = data.beverageSales.filter((item) => item.date === selectedDate);
  const dayExpenses = data.expenses.filter((item) => item.date === selectedDate);
  const totals = useMemo(() => {
    const flavio = dayAppointments.filter((item) => item.professional === 'Flávio').reduce((sum, item) => sum + item.amount_cents, 0);
    const fernando = dayAppointments.filter((item) => item.professional === 'Fernando').reduce((sum, item) => sum + item.amount_cents, 0);
    const drinks = daySales.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0);
    const expenses = dayExpenses.reduce((sum, item) => sum + item.amount_cents, 0);
    return { flavio, fernando, services: flavio + fernando, drinks, expenses };
  }, [dayAppointments, daySales, dayExpenses]);

  const monthly = useMemo(() => {
    const flavio = data.appointments.filter((item) => item.professional === 'Flávio').reduce((sum, item) => sum + item.amount_cents, 0);
    const fernando = data.appointments.filter((item) => item.professional === 'Fernando').reduce((sum, item) => sum + item.amount_cents, 0);
    const drinks = data.beverageSales.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0);
    const expenses = data.expenses.reduce((sum, item) => sum + item.amount_cents, 0);
    return { flavio, fernando, services: flavio + fernando, drinks, expenses };
  }, [data]);

  function changeMonth(offset: number) {
    const value = new Date(`${month}-15T12:00:00Z`); value.setUTCMonth(value.getUTCMonth() + offset);
    const next = value.toISOString().slice(0, 7); setMonth(next); setSelectedDate(`${next}-01`);
  }

  async function save(payload: Record<string, unknown>, success: string, method: 'POST' | 'PATCH' = 'POST') {
    setError('');
    try {
      const scrollY = window.scrollY;
      const response = await fetch('/api/data', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { id?: number; error?: string };
      if (!response.ok) { setError(result.error || 'Não foi possível salvar.'); return false; }
      if (method === 'POST' && payload.entity === 'appointment' && result.id) { setRecentlyAddedId(Number(result.id)); window.setTimeout(() => setRecentlyAddedId(null), 3200); }
      setNotice(success); window.setTimeout(() => setNotice(''), 2600); await refresh(true); window.requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'auto' })); return true;
    } catch { setError('Não foi possível salvar. Verifique se o sistema local está ligado.'); return false; }
  }

  async function remove(entity: string, id: number) {
    if (!window.confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return;
    const response = await fetch(`/api/data?entity=${entity}&id=${id}`, { method: 'DELETE' });
    if (!response.ok) { setError('Não foi possível excluir o lançamento.'); return; }
    await refresh(true);
  }

  function exportCsv() {
    const rows = [['Data', 'Profissional', 'Pagamento', 'Serviço', 'Cliente', 'Valor'], ...data.appointments.map((item) => [item.date, item.professional, item.payment, item.service, item.client, (item.amount_cents / 100).toFixed(2).replace('.', ',')])];
    const csv = '\ufeff' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `atendimentos-${month}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'create_appointment', title: 'Adicionar atendimento', description: 'Registra um atendimento de Flávio ou Fernando e atualiza os repasses de 60% e 40%.',
      inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'Data no formato AAAA-MM-DD' }, professional: { type: 'string', enum: ['Flávio', 'Fernando'] }, payment: { type: 'string' }, service: { type: 'string' }, client: { type: 'string' }, amount: { type: 'number', minimum: 0.01 }, time: { type: 'string', description: 'Horário HH:MM' } }, required: ['date', 'professional', 'payment', 'service', 'amount', 'time'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: unknown) => { const item = input as Record<string, unknown>; const response = await fetch('/api/data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'appointment', ...item, amountCents: Math.round(Number(item.amount) * 100) }) }); const result = await response.json() as Record<string, unknown>; if (!response.ok) throw new Error(String(result.error || 'Não foi possível salvar.')); setMonth(String(item.date).slice(0, 7)); setSelectedDate(String(item.date)); setSection('atendimentos'); await refresh(); return { id: result.id, saved: true, professional: item.professional, amount: item.amount }; },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [refresh]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#172b36] text-white shadow-sm">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#f2a24a] text-[#172b36]"><Scissors className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/55">Controle da barbearia</p><h1 className="text-lg font-bold tracking-tight">Resumo de repasses</h1></div></div>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto" aria-label="Seções">
            <Nav active={section === 'atendimentos'} onClick={() => setSection('atendimentos')} icon={<Scissors />}>Atendimentos</Nav><Nav active={section === 'bebidas'} onClick={() => setSection('bebidas')} icon={<Beer />}>Bebidas</Nav><Nav active={section === 'gastos'} onClick={() => setSection('gastos')} icon={<ReceiptText />}>Gastos</Nav><Nav active={section === 'resumo'} onClick={() => setSection('resumo')} icon={<CircleDollarSign />}>Resumo mensal</Nav>
          </nav>
          <Button className="order-2 h-9 bg-[#f2a24a] px-3 font-bold text-[#172b36] hover:bg-[#ffb65f] sm:order-3" onClick={() => document.getElementById('entry-form')?.scrollIntoView({ behavior: 'smooth' })}><Plus /> Lançar</Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-8">
        <section className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-1 text-sm font-medium text-muted-foreground">Visão do mês</p><h2 className="font-heading text-3xl font-bold tracking-tight capitalize">{monthLabel.format(new Date(`${month}-01T12:00:00Z`))}</h2></div>
          <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={exportCsv}><Download /> Exportar CSV</Button><div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-sm"><Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft /></Button><Input className="h-8 w-[150px] border-0 text-center font-semibold shadow-none focus-visible:ring-0" type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setMonth(e.target.value.slice(0, 7)); }} /><Button variant="ghost" size="icon" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ChevronRight /></Button></div></div>
        </section>

        {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary icon={<CircleDollarSign />} label="Faturamento bruto do dia" value={money.format(totals.services / 100)} highlight />
          <Summary icon={<Users />} label="Clientes atendidos" value={String(dayAppointments.length)} />
          <ProfessionalSplitSummary flavio={totals.flavio} fernando={totals.fernando} />
          <Summary icon={<Banknote />} label="Barbearia · 40% dos dois" value={money.format(totals.services * 0.4 / 100)} />
        </section>

        {loading ? <div className="grid min-h-64 place-items-center rounded-2xl border bg-card"><LoaderCircle className="size-7 animate-spin text-[#d47724]" /></div> : section === 'atendimentos' ? (
          <Appointments items={dayAppointments} totals={totals} selectedDate={selectedDate} save={save} remove={remove} monthly={monthly} recentlyAddedId={recentlyAddedId} />
        ) : section === 'bebidas' ? (
          <Beverages products={data.products} sales={daySales} selectedDate={selectedDate} post={(payload, success) => save(payload, success)} remove={remove} />
        ) : section === 'gastos' ? (
          <Expenses items={dayExpenses} selectedDate={selectedDate} post={(payload, success) => save(payload, success)} remove={remove} />
        ) : <Monthly data={data} totals={monthly} />}
      </div>
    </main>
  );
}

function Appointments({ items, totals, selectedDate, save, remove, monthly, recentlyAddedId }: { items: Appointment[]; totals: ReturnType<typeof dayTotals>; selectedDate: string; save: (payload: Record<string, unknown>, success: string, method?: 'POST' | 'PATCH') => Promise<boolean>; remove: (entity: string, id: number) => Promise<void>; monthly: ReturnType<typeof monthTotals>; recentlyAddedId: number | null }) {
  const [professional, setProfessional] = useState<'Flávio' | 'Fernando'>('Flávio'), [payment, setPayment] = useState('QR/CODE'), [service, setService] = useState('Corte'), [client, setClient] = useState('Cliente'), [amount, setAmount] = useState('40'), [time, setTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })), [editingId, setEditingId] = useState<number | null>(null);
  function resetForm() { setEditingId(null); setProfessional('Flávio'); setPayment('QR/CODE'); setService('Corte'); setClient('Cliente'); setAmount('40'); }
  function edit(item: Appointment) { setEditingId(item.id); setProfessional(item.professional); setPayment(item.payment); setService(item.service); setClient(item.client); setAmount(String(item.amount_cents / 100).replace('.', ',')); setTime(item.time); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { entity: 'appointment', id: editingId ?? undefined, date: selectedDate, professional, payment, service, client, amountCents: toCents(amount), time };
    const saved = await save(payload, editingId ? 'Atendimento atualizado.' : 'Atendimento adicionado.', editingId ? 'PATCH' : 'POST');
    if (saved) resetForm();
  }
  const flavioItems = items.filter((item) => item.professional === 'Flávio');
  const fernandoItems = items.filter((item) => item.professional === 'Fernando');
  return <div className="space-y-4"><div className="grid items-start gap-4 lg:grid-cols-3"><ProfessionalPanel name="Flávio" date={selectedDate} items={flavioItems} total={totals.flavio} remove={remove} edit={edit} recentlyAddedId={recentlyAddedId} /><ProfessionalPanel name="Fernando" date={selectedDate} items={fernandoItems} total={totals.fernando} remove={remove} edit={edit} recentlyAddedId={recentlyAddedId} /><form id="entry-form" onSubmit={submit} className="form-card !gap-2.5 !p-4"><div className="flex items-start justify-between gap-3"><FormTitle title={editingId ? 'Editar atendimento' : 'Novo atendimento'} text={editingId ? 'Altere os dados e salve.' : 'O lançamento aparece no lado correto.'} />{editingId && <Button type="button" variant="ghost" size="icon-sm" onClick={resetForm} aria-label="Cancelar edição"><X /></Button>}</div><Field label="Profissional"><NativeSelect className="w-full" value={professional} onChange={(e) => setProfessional(e.target.value as 'Flávio' | 'Fernando')}><NativeSelectOption>Flávio</NativeSelectOption><NativeSelectOption>Fernando</NativeSelectOption></NativeSelect></Field><div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2"><Field label="Serviço"><Input value={service} onChange={(e) => setService(e.target.value)} required /></Field><Field label="Cliente"><Input value={client} onChange={(e) => setClient(e.target.value)} /></Field></div><div className="grid grid-cols-2 gap-2.5"><Field label="Pagamento"><Payment value={payment} onChange={setPayment} /></Field><Field label="Horário"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></Field></div><Field label="Valor"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field><Split cents={toCents(amount)} /><Submit>{editingId ? 'Salvar alterações' : 'Adicionar atendimento'}</Submit></form></div><ProfessionalCard daily={totals} monthly={monthly} /></div>;
}

function ProfessionalPanel({ name, date, items, total, remove, edit, recentlyAddedId }: { name: 'Flávio' | 'Fernando'; date: string; items: Appointment[]; total: number; remove: (entity: string, id: number) => Promise<void>; edit: (item: Appointment) => void; recentlyAddedId: number | null }) {
  const flavio = name === 'Flávio';
  return <section className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${flavio ? 'border-[#8fc8b9]' : 'border-[#b6b9dd]'}`}><div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${flavio ? 'bg-[#e7f3ef]' : 'bg-[#eeeefa]'}`}><div><p className={`text-[11px] font-bold uppercase tracking-[.14em] ${flavio ? 'text-[#397567]' : 'text-[#565b91]'}`}>Lado {name}</p><h3 className="text-lg font-black">{name}</h3><p className="text-xs text-muted-foreground">{displayDate(date)} · {items.length} atendimentos</p></div><div className="text-right"><p className="text-xs font-semibold text-muted-foreground">Total do dia</p><p className="text-lg font-black tabular-nums">{money.format(total / 100)}</p></div></div>{items.length ? <table className="professional-table"><thead><tr><th>Serviço / cliente</th><th>Pgto. / hora</th><th className="text-right">Valor</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id} className={item.id === recentlyAddedId ? 'recently-added' : ''}><td><strong>{item.service}</strong><small>{item.client}</small></td><td><strong className="!font-medium">{item.payment}</strong><small>{item.time}</small></td><td className="text-right font-bold text-foreground">{money.format(item.amount_cents / 100)}</td><td><div className="flex justify-end"><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-[#b45f16]" onClick={() => edit(item)} aria-label="Editar atendimento"><Pencil /></Button><Delete onClick={() => void remove('appointment', item.id)} /></div></td></tr>)}</tbody></table> : <Empty text={`Nenhum atendimento de ${name} neste dia.`} />}</section>;
}

function Beverages({ products, sales, selectedDate, post, remove }: { products: Product[]; sales: BeverageSale[]; selectedDate: string; post: (payload: Record<string, unknown>, success: string) => Promise<boolean>; remove: (entity: string, id: number) => Promise<void> }) {
  const [productId, setProductId] = useState(''), [quantity, setQuantity] = useState('1'), [client, setClient] = useState('Cliente'), [name, setName] = useState(''), [price, setPrice] = useState('6'), [stock, setStock] = useState('0');
  useEffect(() => { if (!productId && products[0]) setProductId(String(products[0].id)); }, [products, productId]);
  async function sale(event: FormEvent) { event.preventDefault(); await post({ entity: 'beverageSale', date: selectedDate, productId: Number(productId), quantity: Number(quantity), client }, 'Venda de bebida adicionada.'); }
  async function product(event: FormEvent) { event.preventDefault(); if (await post({ entity: 'product', name, priceCents: toCents(price), stock: Number(stock) }, 'Bebida cadastrada.')) { setName(''); setStock('0'); } }
  const total = sales.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0);
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="space-y-5"><DataCard title={`Bebidas de ${displayDate(selectedDate)}`} subtitle={`Total vendido: ${money.format(total / 100)}`} count={sales.reduce((sum, item) => sum + item.quantity, 0)}>{sales.length ? <table className="data-table"><thead><tr><th>Bebida</th><th>Cliente</th><th>Quantidade</th><th className="text-right">Total</th><th /></tr></thead><tbody>{sales.map((item) => <tr key={item.id}><td className="font-bold">{item.product_name}</td><td>{item.client}</td><td>{item.quantity}</td><td className="text-right font-bold">{money.format(item.quantity * item.unit_price_cents / 100)}</td><td className="w-10"><Delete onClick={() => void remove('beverageSale', item.id)} /></td></tr>)}</tbody></table> : <Empty text="Nenhuma bebida vendida neste dia." />}</DataCard><DataCard title="Estoque atual" subtitle="Preço e saldo disponíveis" count={products.length}>{products.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{products.map((item) => <article key={item.id} className="rounded-xl border bg-muted/25 p-4"><div className="flex justify-between gap-2"><strong>{item.name}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.stock < 5 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{item.stock} un.</span></div><p className="mt-2 text-sm text-muted-foreground">{money.format(item.price_cents / 100)}</p></article>)}</div> : <Empty text="Cadastre a primeira bebida ao lado." />}</DataCard></div><aside className="space-y-5"><form id="entry-form" className="form-card" onSubmit={sale}><FormTitle title="Vender bebida" text="O preço entra automaticamente." /><Field label="Bebida"><NativeSelect className="w-full" value={productId} onChange={(e) => setProductId(e.target.value)} required><NativeSelectOption value="">Selecione</NativeSelectOption>{products.map((item) => <NativeSelectOption key={item.id} value={String(item.id)}>{item.name} · {item.stock} un.</NativeSelectOption>)}</NativeSelect></Field><div className="grid grid-cols-2 gap-3"><Field label="Quantidade"><Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field><Field label="Cliente"><Input value={client} onChange={(e) => setClient(e.target.value)} /></Field></div><Submit disabled={!products.length}>Registrar venda</Submit></form><form className="form-card" onSubmit={product}><FormTitle title="Cadastrar bebida" text="Defina preço e estoque inicial." /><Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Heineken" required /></Field><div className="grid grid-cols-2 gap-3"><Field label="Preço"><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field><Field label="Estoque"><Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} /></Field></div><Submit>Cadastrar bebida</Submit></form></aside></div>;
}

function Expenses({ items, selectedDate, post, remove }: { items: Expense[]; selectedDate: string; post: (payload: Record<string, unknown>, success: string) => Promise<boolean>; remove: (entity: string, id: number) => Promise<void> }) {
  const [description, setDescription] = useState(''), [category, setCategory] = useState('Material'), [payment, setPayment] = useState('QR/CODE'), [amount, setAmount] = useState(''); const total = items.reduce((sum, item) => sum + item.amount_cents, 0);
  async function submit(event: FormEvent) { event.preventDefault(); if (await post({ entity: 'expense', date: selectedDate, description, category, payment, amountCents: toCents(amount) }, 'Gasto adicionado.')) { setDescription(''); setAmount(''); } }
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"><DataCard title={`Gastos de ${displayDate(selectedDate)}`} subtitle={`Total do dia: ${money.format(total / 100)}`} count={items.length}>{items.length ? <table className="data-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Pagamento</th><th className="text-right">Valor</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="font-bold">{item.description}</td><td>{item.category}</td><td>{item.payment}</td><td className="text-right font-bold">{money.format(item.amount_cents / 100)}</td><td className="w-10"><Delete onClick={() => void remove('expense', item.id)} /></td></tr>)}</tbody></table> : <Empty text="Nenhum gasto lançado neste dia." />}</DataCard><form id="entry-form" className="form-card" onSubmit={submit}><FormTitle title="Novo gasto" text="Registre as saídas da barbearia." /><Field label="Descrição"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Produtos de limpeza" required /></Field><Field label="Categoria"><NativeSelect className="w-full" value={category} onChange={(e) => setCategory(e.target.value)}><NativeSelectOption>Material</NativeSelectOption><NativeSelectOption>Manutenção</NativeSelectOption><NativeSelectOption>Aluguel</NativeSelectOption><NativeSelectOption>Contas</NativeSelectOption><NativeSelectOption>Outros</NativeSelectOption></NativeSelect></Field><div className="grid grid-cols-2 gap-3"><Field label="Pagamento"><Payment value={payment} onChange={setPayment} /></Field><Field label="Valor"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field></div><Submit>Adicionar gasto</Submit></form></div>;
}

function Monthly({ data, totals }: { data: DataSet; totals: ReturnType<typeof monthTotals> }) {
  const days = Array.from(new Set([...data.appointments.map((x) => x.date), ...data.beverageSales.map((x) => x.date), ...data.expenses.map((x) => x.date)])).sort().reverse();
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"><DataCard title="Fechamento por dia" subtitle="Serviços, bebidas e gastos no mês" count={days.length}>{days.length ? <table className="data-table"><thead><tr><th>Data</th><th className="text-right">Flávio</th><th className="text-right">Fernando</th><th className="text-right">Bebidas</th><th className="text-right">Gastos</th><th className="text-right">40% barbearia</th></tr></thead><tbody>{days.map((date) => { const appointments = data.appointments.filter((x) => x.date === date); const flavio = appointments.filter((x) => x.professional === 'Flávio').reduce((s, x) => s + x.amount_cents, 0); const fernando = appointments.filter((x) => x.professional === 'Fernando').reduce((s, x) => s + x.amount_cents, 0); const drinks = data.beverageSales.filter((x) => x.date === date).reduce((s, x) => s + x.quantity * x.unit_price_cents, 0); const expenses = data.expenses.filter((x) => x.date === date).reduce((s, x) => s + x.amount_cents, 0); return <tr key={date}><td className="font-bold">{displayDate(date)}</td><td className="text-right">{money.format(flavio / 100)}</td><td className="text-right">{money.format(fernando / 100)}</td><td className="text-right">{money.format(drinks / 100)}</td><td className="text-right text-red-700">{money.format(expenses / 100)}</td><td className="text-right font-bold">{money.format((flavio + fernando) * .4 / 100)}</td></tr>; })}</tbody></table> : <Empty text="Nenhum movimento neste mês." />}</DataCard><aside className="space-y-5"><section className="rounded-2xl bg-[#172b36] p-5 text-white shadow-sm"><p className="mb-5 text-xs font-bold uppercase tracking-[.14em] text-white/55">Fechamento do mês</p><BigLine label="Serviços" value={totals.services} /><BigLine label="Bebidas" value={totals.drinks} /><BigLine label="Gastos" value={totals.expenses} negative /><div className="my-4 h-px bg-white/15" /><BigLine label="Saldo da barbearia" value={totals.services * .4 + totals.drinks - totals.expenses} strong /></section><section className="rounded-2xl border bg-card p-5 shadow-sm"><FormTitle title="Repasses do mês" text="Mesma regra da planilha: 60% e 40%." /><PersonSummary name="Flávio" total={totals.flavio} /><div className="my-4 h-px bg-border" /><PersonSummary name="Fernando" total={totals.fernando} /></section></aside></div>;
}

const dayTotals = () => ({ flavio: 0, fernando: 0, services: 0, drinks: 0, expenses: 0 });
const monthTotals = dayTotals;
function Nav({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) { return <button onClick={onClick} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? 'bg-white/12 text-white' : 'text-white/55 hover:bg-white/7 hover:text-white'} [&_svg]:size-4`}>{icon}{children}</button>; }
function Summary({ icon, label, value, highlight = false }: { icon: ReactNode; label: string; value: string; highlight?: boolean }) { return <article className={`rounded-2xl border p-5 shadow-sm ${highlight ? 'border-[#f2a24a]/45 bg-[#fff7ea]' : 'bg-card'}`}><span className={`mb-4 grid size-9 place-items-center rounded-xl [&_svg]:size-4 ${highlight ? 'bg-[#f2a24a] text-[#172b36]' : 'bg-muted text-muted-foreground'}`}>{icon}</span><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black tracking-tight tabular-nums">{value}</p></article>; }
function ProfessionalSplitSummary({ flavio, fernando }: { flavio: number; fernando: number }) { return <article className="rounded-2xl border bg-card p-5 shadow-sm"><span className="mb-3 grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-4"><WalletCards /></span><p className="text-sm text-muted-foreground">Profissionais · 60%</p><div className="mt-2 grid grid-cols-2 gap-3"><div><p className="text-xs font-semibold text-[#397567]">Flávio</p><p className="text-lg font-black tabular-nums">{money.format(flavio * .6 / 100)}</p></div><div><p className="text-xs font-semibold text-[#565b91]">Fernando</p><p className="text-lg font-black tabular-nums">{money.format(fernando * .6 / 100)}</p></div></div></article>; }
function DataCard({ title, subtitle, count, children }: { title: string; subtitle: string; count: number; children: ReactNode }) { return <section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><h3 className="font-bold">{title}</h3><p className="text-sm text-muted-foreground">{subtitle}</p></div><span className="rounded-full bg-[#f2a24a]/15 px-3 py-1 text-xs font-bold text-[#a45113]">{count} registros</span></div><div className="overflow-x-auto">{children}</div></section>; }
function FormTitle({ title, text }: { title: string; text: string }) { return <div className="mb-1"><h3 className="font-bold">{title}</h3><p className="text-sm text-muted-foreground">{text}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-xs font-bold text-muted-foreground"><span>{label}</span>{children}</label>; }
function Payment({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <NativeSelect className="w-full" value={value} onChange={(e) => onChange(e.target.value)}><NativeSelectOption>QR/CODE</NativeSelectOption><NativeSelectOption>Débito</NativeSelectOption><NativeSelectOption>Crédito</NativeSelectOption><NativeSelectOption>Dinheiro</NativeSelectOption><NativeSelectOption>Não pagou</NativeSelectOption></NativeSelect>; }
function Split({ cents }: { cents: number }) { return <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/55 p-3 text-sm"><div><p className="text-xs text-muted-foreground">Profissional · 60%</p><p className="font-bold">{money.format(cents * .6 / 100)}</p></div><div><p className="text-xs text-muted-foreground">Barbearia · 40%</p><p className="font-bold">{money.format(cents * .4 / 100)}</p></div></div>; }
function Submit({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) { return <Button type="submit" disabled={disabled} className="mt-1 h-11 w-full bg-[#172b36] font-bold text-white hover:bg-[#274553]"><Plus />{children}</Button>; }
function Delete({ onClick }: { onClick: () => void }) { return <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-red-700" onClick={onClick} aria-label="Excluir"><Trash2 /></Button>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-44 place-items-center p-8 text-center text-sm text-muted-foreground"><div><CalendarDays className="mx-auto mb-3 size-7 opacity-40" /><p>{text}</p></div></div>; }
function ProfessionalCard({ daily, monthly }: { daily: ReturnType<typeof dayTotals>; monthly: ReturnType<typeof monthTotals> }) { return <section className="rounded-2xl bg-[#172b36] p-5 text-white shadow-sm"><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-white/55">Repasses por profissional no dia</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white/7 p-4"><PersonSummary name="Flávio" total={daily.flavio} /></div><div className="rounded-xl bg-white/7 p-4"><PersonSummary name="Fernando" total={daily.fernando} /></div></div><div className="mt-4 grid gap-2 rounded-xl border border-white/10 p-3 text-xs text-white/65 sm:grid-cols-2"><span>Flávio no mês: {money.format(monthly.flavio / 100)}</span><span>Fernando no mês: {money.format(monthly.fernando / 100)}</span></div></section>; }
function PersonSummary({ name, total }: { name: string; total: number }) { return <div><div className="flex items-center justify-between"><span className="font-bold">{name}</span><span className="font-black tabular-nums">{money.format(total / 100)}</span></div><div className="mt-2 flex justify-between gap-2 text-xs opacity-60"><span>60%: {money.format(total * .6 / 100)}</span><span>40%: {money.format(total * .4 / 100)}</span></div></div>; }
function BigLine({ label, value, negative = false, strong = false }: { label: string; value: number; negative?: boolean; strong?: boolean }) { return <div className={`mb-3 flex items-center justify-between gap-4 ${strong ? 'text-lg' : 'text-sm'}`}><span className={strong ? 'font-bold' : 'text-white/60'}>{label}</span><span className={`font-black tabular-nums ${negative ? 'text-[#ffb17a]' : ''}`}>{negative ? '− ' : ''}{money.format(Math.abs(value) / 100)}</span></div>; }
