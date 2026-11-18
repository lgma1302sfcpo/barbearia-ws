type ServicePayment = {
  payment: string;
  amount_cents: number;
  distribution?: string;
};

export function professionalShare(item: ServicePayment) {
  return item.amount_cents * (item.distribution === 'shop' ? 0 : 0.6);
}

export function distributionAdjustment(items: readonly ServicePayment[]) {
  return items.reduce((sum, item) => item.payment === 'Não pagou'
    ? sum - unpaidShopShare(item)
    : sum + professionalShare(item) - item.amount_cents * 0.6, 0);
}

export function unpaidShopShare(item: ServicePayment) {
  return Math.round(item.amount_cents - professionalShare(item));
}

export function pixFlavioPaidShare(items: readonly ServicePayment[]) {
  return items.reduce(
    (sum, item) => item.payment === 'PIX FLAVIO'
      ? sum + professionalShare(item)
      : sum,
    0,
  );
}

export function professionalBalance(total: number, expenses = 0, paidShare = 0, adjustment = 0, tips = 0) {
  return (total - tips) * 0.6 + tips + adjustment - expenses - paidShare;
}

export function shopServiceShare(total: number, adjustment = 0) {
  // The adjustment already transfers unpaid shop shares from the professional.
  return total * 0.4 - adjustment;
}

type DailyService = ServicePayment & {
  id: number;
  professional: string;
  client: string;
  time: string;
  tip_cents?: number;
};

type DailySummaryInput = {
  appointments: readonly DailyService[];
  monthlyCuts: readonly DailyService[];
  expenses: readonly { professional: string | null; amount_cents: number }[];
  sales: readonly { quantity: number; unit_price_cents: number }[];
};

type DailySummaryEntry = {
  key: string;
  tone: 'note' | 'tip' | 'warning';
  text: string;
};

const summaryMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const summaryAmount = (cents: number) => summaryMoney.format(cents / 100);

export function buildDailySummary({ appointments, monthlyCuts, expenses, sales }: DailySummaryInput) {
  const entries: DailySummaryEntry[] = [];
  const services = [
    ...appointments.map((item) => ({ ...item, kind: 'appointment' })),
    ...monthlyCuts.map((item) => ({ ...item, kind: 'monthly' })),
  ].sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id || a.kind.localeCompare(b.kind));

  if (services.length > 0) {
    const unpaid = services.filter((item) => item.payment === 'Não pagou').length;
    entries.push({
      key: 'appointments',
      tone: 'note',
      text: `${services.length} atendimento${services.length === 1 ? '' : 's'} no dia: ${services.length - unpaid} pago${services.length - unpaid === 1 ? '' : 's'} e ${unpaid} não pago${unpaid === 1 ? '' : 's'}.`,
    });
  }

  for (const professional of new Set(appointments.map((item) => item.professional))) {
    const tips = appointments
      .filter((item) => item.professional === professional)
      .reduce((sum, item) => sum + (item.tip_cents || 0), 0);
    if (tips > 0) entries.push({
      key: `tips-${professional}`,
      tone: 'tip',
      text: `${professional} recebeu ${summaryAmount(tips)} de caixinha, já somados integralmente ao repasse dele.`,
    });
  }

  services.forEach((item, index) => {
    const client = item.client.trim();
    const label = item.kind === 'monthly'
      ? `Plano mensal${client && client !== 'Cliente' ? ` de ${client}` : ''}`
      : `${index + 1}º cliente do dia${client && client !== 'Cliente' ? ` (${client})` : ''}`;
    if (item.payment === 'Não pagou') {
      const deduction = unpaidShopShare(item);
      entries.push({
        key: `unpaid-${item.kind}-${item.id}`,
        tone: 'warning',
        text: deduction > 0
          ? `${label} não pagou. ${summaryAmount(deduction)} descontados do repasse de ${item.professional}, como parte da barbearia a compensar.`
          : `${label} não pagou e está sem valor. Informe o preço para calcular o desconto no repasse de ${item.professional}.`,
      });
    } else if (item.payment === 'Misto') {
      entries.push({
        key: `mixed-${item.kind}-${item.id}`,
        tone: 'note',
        text: `${label}, atendido por ${item.professional}, pagou ${summaryAmount(item.amount_cents)} com pagamento misto, já incluídos nos valores do dia.`,
      });
    }
  });

  const pixPaid = pixFlavioPaidShare(services);
  if (pixPaid > 0) entries.push({
    key: 'pix-flavio',
    tone: 'note',
    text: `${summaryAmount(pixPaid)} do repasse de Flávio já foram pagos via PIX FLAVIO e descontados do valor a repassar.`,
  });

  for (const professional of new Set(expenses.map((item) => item.professional))) {
    const amount = expenses
      .filter((item) => item.professional === professional)
      .reduce((sum, item) => sum + item.amount_cents, 0);
    if (amount > 0) entries.push({
      key: `expenses-${professional ?? 'shop'}`,
      tone: professional ? 'warning' : 'note',
      text: professional
        ? `${professional} teve ${summaryAmount(amount)} em gastos, já descontados do repasse dele.`
        : `A barbearia teve ${summaryAmount(amount)} em gastos registrados no dia.`,
    });
  }

  const drinks = sales.reduce((sum, item) => sum + item.quantity, 0);
  if (drinks > 0) entries.push({
    key: 'beverages',
    tone: 'note',
    text: `${drinks} bebida${drinks === 1 ? '' : 's'} vendida${drinks === 1 ? '' : 's'} no dia, totalizando ${summaryAmount(sales.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0))}.`,
  });

  return entries;
}
