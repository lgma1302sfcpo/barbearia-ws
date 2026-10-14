type ServicePayment = {
  payment: string;
  amount_cents: number;
};

export function pixFlavioPaidShare(items: readonly ServicePayment[]) {
  return items.reduce(
    (sum, item) => item.payment === 'PIX FLAVIO'
      ? sum + item.amount_cents * 0.6
      : sum,
    0,
  );
}

export function professionalBalance(total: number, expenses = 0, paidShare = 0) {
  return total * 0.6 - expenses - paidShare;
}
