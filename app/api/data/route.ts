import { env } from 'cloudflare:workers';

const json = (data: unknown, status = 200) => Response.json(data, { status });
const clean = (value: unknown, max = 120) => String(value ?? '').trim().slice(0, max);
const positiveInt = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') ?? '') ? url.searchParams.get('month')! : new Date().toISOString().slice(0, 7);
  const pattern = `${month}-%`;
  const [appointments, beverageSales, products, expenses] = await Promise.all([
    env.DB.prepare('SELECT * FROM appointments WHERE date LIKE ? ORDER BY date DESC, id ASC').bind(pattern).all(),
    env.DB.prepare('SELECT * FROM beverage_sales WHERE date LIKE ? ORDER BY date DESC, id DESC').bind(pattern).all(),
    env.DB.prepare('SELECT * FROM beverage_products ORDER BY name COLLATE NOCASE').all(),
    env.DB.prepare('SELECT * FROM expenses WHERE date LIKE ? ORDER BY date DESC, id DESC').bind(pattern).all(),
  ]);
  return json({ month, appointments: appointments.results, beverageSales: beverageSales.results, products: products.results, expenses: expenses.results });
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const entity = clean(body.entity, 30);
  const now = new Date().toISOString();
  if (entity === 'appointment') {
    const date = clean(body.date, 10), professional = clean(body.professional, 30), service = clean(body.service), amountCents = positiveInt(body.amountCents);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['Flávio', 'Fernando'].includes(professional) || !service || amountCents < 1) return json({ error: 'Preencha profissional, serviço, data e valor.' }, 400);
    const result = await env.DB.prepare('INSERT INTO appointments (date, professional, payment, service, client, amount_cents, time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(date, professional, clean(body.payment, 40) || 'Não informado', service, clean(body.client) || 'Cliente', amountCents, clean(body.time, 5) || '00:00', now).run();
    return json({ id: result.meta.last_row_id }, 201);
  }
  if (entity === 'product') {
    const name = clean(body.name, 60), priceCents = positiveInt(body.priceCents);
    if (!name || priceCents < 1) return json({ error: 'Informe o nome e o preço da bebida.' }, 400);
    try { const result = await env.DB.prepare('INSERT INTO beverage_products (name, price_cents, stock) VALUES (?, ?, ?)').bind(name, priceCents, positiveInt(body.stock)).run(); return json({ id: result.meta.last_row_id }, 201); }
    catch { return json({ error: 'Já existe uma bebida com esse nome.' }, 409); }
  }
  if (entity === 'beverageSale') {
    const productId = positiveInt(body.productId), quantity = positiveInt(body.quantity);
    const product = await env.DB.prepare('SELECT * FROM beverage_products WHERE id = ?').bind(productId).first<Record<string, unknown>>();
    if (!product || quantity < 1 || Number(product.stock) < quantity) return json({ error: 'Bebida inválida ou estoque insuficiente.' }, 400);
    const result = await env.DB.batch([
      env.DB.prepare('INSERT INTO beverage_sales (date, product_id, product_name, client, quantity, unit_price_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(clean(body.date, 10), productId, product.name, clean(body.client) || 'Cliente', quantity, product.price_cents, now),
      env.DB.prepare('UPDATE beverage_products SET stock = stock - ? WHERE id = ?').bind(quantity, productId),
    ]);
    return json({ id: result[0].meta.last_row_id }, 201);
  }
  if (entity === 'expense') {
    const description = clean(body.description), amountCents = positiveInt(body.amountCents);
    if (!description || amountCents < 1) return json({ error: 'Informe a descrição e o valor do gasto.' }, 400);
    const result = await env.DB.prepare('INSERT INTO expenses (date, description, category, payment, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(clean(body.date, 10), description, clean(body.category, 60) || 'Outros', clean(body.payment, 40) || 'Não informado', amountCents, now).run();
    return json({ id: result.meta.last_row_id }, 201);
  }
  return json({ error: 'Tipo de lançamento inválido.' }, 400);
}

export async function PATCH(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const id = positiveInt(body.id), date = clean(body.date, 10), professional = clean(body.professional, 30), service = clean(body.service), amountCents = positiveInt(body.amountCents);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['Flávio', 'Fernando'].includes(professional) || !service || amountCents < 1) return json({ error: 'Preencha profissional, serviço, data e valor.' }, 400);
  const result = await env.DB.prepare('UPDATE appointments SET date = ?, professional = ?, payment = ?, service = ?, client = ?, amount_cents = ?, time = ? WHERE id = ?')
    .bind(date, professional, clean(body.payment, 40) || 'Não informado', service, clean(body.client) || 'Cliente', amountCents, clean(body.time, 5) || '00:00', id).run();
  if (!result.meta.changes) return json({ error: 'Atendimento não encontrado.' }, 404);
  return json({ id, updated: true });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url), id = positiveInt(url.searchParams.get('id')), entity = url.searchParams.get('entity');
  if (!id) return json({ error: 'Registro inválido.' }, 400);
  if (entity === 'appointment') await env.DB.prepare('DELETE FROM appointments WHERE id = ?').bind(id).run();
  else if (entity === 'expense') await env.DB.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run();
  else if (entity === 'beverageSale') {
    const sale = await env.DB.prepare('SELECT product_id, quantity FROM beverage_sales WHERE id = ?').bind(id).first<Record<string, number>>();
    if (sale) await env.DB.batch([env.DB.prepare('DELETE FROM beverage_sales WHERE id = ?').bind(id), env.DB.prepare('UPDATE beverage_products SET stock = stock + ? WHERE id = ?').bind(sale.quantity, sale.product_id)]);
  } else return json({ error: 'Tipo de registro inválido.' }, 400);
  return json({ ok: true });
}
