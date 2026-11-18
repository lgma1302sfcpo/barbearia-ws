import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  distributionAdjustment,
  unpaidShopShare,
  pixFlavioPaidShare,
  professionalBalance,
  shopServiceShare,
  buildDailySummary,
} from './payment-totals.ts';

const unpaid = { payment: 'Não pagou', amount_cents: 4000 };
const paid = { payment: 'Dinheiro', amount_cents: 4000 };

test('the first unpaid R$40 service leaves the professional owing R$16', () => {
  assert.equal(unpaidShopShare(unpaid), 1600);
  assert.equal(professionalBalance(0, 0, 0, distributionAdjustment([unpaid])), -1600);
  assert.equal(shopServiceShare(0, distributionAdjustment([unpaid])), 1600);
});

test('a paid R$40 service after an unpaid one leaves R$8 for the professional', () => {
  assert.equal(professionalBalance(4000, 0, 0, distributionAdjustment([unpaid, paid])), 800);
  assert.equal(shopServiceShare(4000, distributionAdjustment([unpaid, paid])), 3200);
});

test('unpaid debts accumulate across days in the monthly balance', () => {
  const items = [unpaid, { ...unpaid, amount_cents: 7000 }, paid];
  assert.equal(professionalBalance(4000, 0, 0, distributionAdjustment(items)), -2000);
  assert.equal(shopServiceShare(4000, distributionAdjustment(items)), 6000);
});

test('changing an unpaid service to paid replaces the debt with its commission', () => {
  assert.equal(professionalBalance(0, 0, 0, distributionAdjustment([unpaid])), -1600);
  assert.equal(professionalBalance(4000, 0, 0, distributionAdjustment([paid])), 2400);
  assert.equal(shopServiceShare(4000, distributionAdjustment([paid])), 1600);
  assert.equal(professionalBalance(0, 0, 0, distributionAdjustment([])), 0);
  assert.equal(shopServiceShare(0, distributionAdjustment([])), 0);
});

test('an unpaid service allocated entirely to the shop charges the full amount', () => {
  const item = { ...unpaid, distribution: 'shop' };
  assert.equal(unpaidShopShare(item), 4000);
  assert.equal(professionalBalance(0, 0, 0, distributionAdjustment([item])), -4000);
  assert.equal(shopServiceShare(0, distributionAdjustment([item])), 4000);
});

test('paid services allocated entirely to the shop still give no commission', () => {
  const items = [paid, { ...paid, distribution: 'shop' }];
  assert.equal(professionalBalance(8000, 0, 0, distributionAdjustment(items)), 2400);
  assert.equal(shopServiceShare(8000, distributionAdjustment(items)), 5600);
});

test('PIX FLAVIO and professional expenses are deducted alongside unpaid debts', () => {
  const pix = { ...paid, payment: 'PIX FLAVIO' };
  const items = [unpaid, paid, pix];
  assert.equal(pixFlavioPaidShare(items), 2400);
  assert.equal(professionalBalance(8000, 500, pixFlavioPaidShare(items), distributionAdjustment(items)), 300);
  assert.equal(shopServiceShare(8000, distributionAdjustment(items)), 4800);
});

test('unpaid shop shares are rounded to whole cents and zero prices add no debt', () => {
  const tiny = { ...unpaid, amount_cents: 3 };
  const zero = { ...unpaid, amount_cents: 0 };
  assert.equal(distributionAdjustment([tiny, zero]), -1);
});

test('R$10 in tips adds the full R$10 to the professional and nothing to the shop', () => {
  assert.equal(professionalBalance(5000, 0, 0, 0, 1000), 3400);
  assert.equal(shopServiceShare(5000 - 1000), 1600);
  assert.equal(professionalBalance(1000, 0, 0, distributionAdjustment([unpaid]), 1000), -600);
  assert.equal(professionalBalance(5000, 0, 2400, 0, 1000), 1000);
  assert.equal(professionalBalance(5000, 0, 0, distributionAdjustment([{ ...paid, distribution: 'shop' }]), 1000), 1000);
});

const service = (overrides = {}) => ({
  ...paid,
  id: 1,
  professional: 'Flávio',
  client: 'Cliente',
  time: '09:00',
  tip_cents: 0,
  ...overrides,
});
const summaries = (overrides = {}) => buildDailySummary({
  appointments: [], monthlyCuts: [], expenses: [], sales: [], ...overrides,
});
const normalized = (entry) => entry.text.replace(/\u00a0/g, ' ');

test('daily summaries show no activity for an empty selected day', () => {
  assert.deepEqual(summaries(), []);
});

test('daily summaries aggregate tips separately for each professional', () => {
  const entries = summaries({ appointments: [
    service({ tip_cents: 500 }),
    service({ id: 2, tip_cents: 500 }),
    service({ id: 3, professional: 'Fernando', tip_cents: 200 }),
  ] });
  assert.match(normalized(entries.find((entry) => entry.key === 'tips-Flávio')), /Flávio recebeu R\$ 10,00.*integralmente/);
  assert.match(normalized(entries.find((entry) => entry.key === 'tips-Fernando')), /Fernando recebeu R\$ 2,00/);
  assert.equal(entries.filter((entry) => entry.tone === 'tip').length, 2);
});

test('unpaid summaries identify the third client by time and the correct professional', () => {
  const appointments = [
    service({ id: 1, time: '11:00', client: 'Carlos', professional: 'Fernando', payment: 'Não pagou' }),
    service({ id: 3, time: '09:00' }),
    service({ id: 2, time: '10:00' }),
  ];
  const originalIds = appointments.map((item) => item.id);
  const entries = summaries({ appointments });
  const entry = entries.find((item) => item.key === 'unpaid-appointment-1');
  assert.match(normalized(entry), /3º cliente do dia \(Carlos\) não pagou.*R\$ 16,00.*Fernando/);
  assert.deepEqual(appointments.map((item) => item.id), originalIds);
  assert.match(entries[0].text, /3 atendimentos.*2 pagos e 1 não pago/);
});

test('unpaid monthly plans and appointments with the same id have separate summaries', () => {
  const entries = summaries({
    appointments: [service({ payment: 'Não pagou' })],
    monthlyCuts: [service({ payment: 'Não pagou', amount_cents: 10000, client: 'Pedro' })],
  });
  assert.equal(new Set(entries.map((entry) => entry.key)).size, entries.length);
  assert.match(normalized(entries.find((entry) => entry.key === 'unpaid-monthly-1')), /Plano mensal de Pedro.*R\$ 40,00/);
});

test('unpaid zero prices ask for the amount instead of claiming a deduction', () => {
  const entries = summaries({ appointments: [service({ payment: 'Não pagou', amount_cents: 0 })] });
  const entry = entries.find((item) => item.key === 'unpaid-appointment-1');
  assert.match(entry.text, /sem valor.*Informe o preço/);
  assert.doesNotMatch(entry.text, /descontados/);
});

test('mixed payments count as received and show the full service amount', () => {
  const item = service({ payment: 'Misto' });
  const entries = summaries({ appointments: [item] });
  assert.match(entries[0].text, /1 pago e 0 não pagos/);
  assert.match(normalized(entries.find((entry) => entry.key === 'mixed-appointment-1')), /R\$ 40,00 com pagamento misto/);
  assert.equal(entries.some((entry) => entry.key.startsWith('unpaid-')), false);
  assert.equal(professionalBalance(4000, 0, pixFlavioPaidShare([item]), distributionAdjustment([item])), 2400);
});

test('daily summaries explain PIX, professional expenses and beverage sales', () => {
  const entries = summaries({
    appointments: [service({ payment: 'PIX FLAVIO' })],
    expenses: [{ professional: 'Fernando', amount_cents: 500 }, { professional: null, amount_cents: 2000 }],
    sales: [{ quantity: 2, unit_price_cents: 500 }],
  });
  assert.match(normalized(entries.find((entry) => entry.key === 'pix-flavio')), /R\$ 24,00.*já foram pagos/);
  assert.match(normalized(entries.find((entry) => entry.key === 'expenses-Fernando')), /Fernando.*R\$ 5,00.*descontados/);
  assert.match(normalized(entries.find((entry) => entry.key === 'expenses-shop')), /barbearia.*R\$ 20,00/);
  assert.match(normalized(entries.find((entry) => entry.key === 'beverages')), /2 bebidas.*R\$ 10,00/);
});
