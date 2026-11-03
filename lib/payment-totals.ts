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
    ? sum
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

export function professionalBalance(total: number, expenses = 0, paidShare = 0, adjustment = 0) {
  return total * 0.6 + adjustment - expenses - paidShare;
}
