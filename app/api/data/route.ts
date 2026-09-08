import { isAuthenticated } from '@/app/auth';
import { ensureSchema, getSql } from '@/db/postgres';

export const runtime = 'nodejs';

const json = (data: unknown, status = 200) => Response.json(data, { status });
const clean = (value: unknown, max = 120) =>
  String(value ?? '')
    .trim()
    .slice(0, max);
const positiveInt = (value: unknown) =>
  Math.max(0, Math.round(Number(value) || 0));

async function database() {
  await ensureSchema();
  return getSql();
}

export async function GET(request: Request) {
  if (!(await isAuthenticated(request)))
    return json({ error: 'Não autorizado.' }, 401);
  const url = new URL(request.url);
  const requestedMonth = url.searchParams.get('month') ?? '';
  const month = /^\d{4}-\d{2}$/.test(requestedMonth)
    ? requestedMonth
    : new Date().toISOString().slice(0, 7);
  const pattern = `${month}-%`;
  const sql = await database();
  const [appointments, beverageSales, products, expenses, monthlyCuts] =
    await Promise.all([
      sql`SELECT * FROM appointments WHERE date LIKE ${pattern} ORDER BY date DESC, id ASC`,
      sql`SELECT * FROM beverage_sales WHERE date LIKE ${pattern} ORDER BY date DESC, id DESC`,
      sql`SELECT * FROM beverage_products ORDER BY LOWER(name)`,
      sql`SELECT * FROM expenses WHERE date LIKE ${pattern} ORDER BY date DESC, id DESC`,
      sql`SELECT * FROM monthly_cuts WHERE month = ${month} ORDER BY professional, client, id`,
    ]);
  return json({
    month,
    appointments,
    beverageSales,
    products,
    expenses,
    monthlyCuts,
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request)))
    return json({ error: 'Não autorizado.' }, 401);
  const body = (await request.json()) as Record<string, unknown>;
  const entity = clean(body.entity, 30);
  const now = new Date().toISOString();
  const sql = await database();

  if (entity === 'appointment') {
    const date = clean(body.date, 10);
    const professional = clean(body.professional, 30);
    const payment = clean(body.payment, 40);
    const service = clean(body.service);
    const amountCents = positiveInt(body.amountCents);
    const customAmount = body.customAmount === true;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !['Flávio', 'Fernando'].includes(professional) ||
      !payment ||
      !service ||
      amountCents < 1
    ) {
      return json(
        {
          error:
            'Selecione profissional e pagamento e preencha serviço, data e valor.',
        },
        400,
      );
    }
    const rows = await sql`INSERT INTO appointments
      (date, professional, payment, service, client, amount_cents, custom_amount, time, created_at)
      VALUES (${date}, ${professional}, ${payment}, ${service},
        ${clean(body.client) || 'Cliente'}, ${amountCents}, ${customAmount}, ${clean(body.time, 5) || '00:00'}, ${now})
      RETURNING id`;
    return json({ id: rows[0].id }, 201);
  }

  if (entity === 'product') {
    const name = clean(body.name, 60);
    const priceCents = positiveInt(body.priceCents);
    if (!name || priceCents < 1)
      return json({ error: 'Informe o nome e o preço da bebida.' }, 400);
    try {
      const rows =
        await sql`INSERT INTO beverage_products (name, price_cents, stock)
        VALUES (${name}, ${priceCents}, ${positiveInt(body.stock)}) RETURNING id`;
      return json({ id: rows[0].id }, 201);
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        return json({ error: 'Já existe uma bebida com esse nome.' }, 409);
      throw error;
    }
  }

  if (entity === 'beverageSale') {
    const productId = positiveInt(body.productId);
    const quantity = positiveInt(body.quantity);
    if (!productId || quantity < 1)
      return json({ error: 'Bebida inválida ou estoque insuficiente.' }, 400);
    const date = clean(body.date, 10);
    const client = clean(body.client) || 'Cliente';
    const rows = await sql`WITH updated AS (
        UPDATE beverage_products SET stock = stock - ${quantity}
        WHERE id = ${productId} AND stock >= ${quantity}
        RETURNING id, name, price_cents
      )
      INSERT INTO beverage_sales (date, product_id, product_name, client, quantity, unit_price_cents, created_at)
      SELECT ${date}, id, name, ${client}, ${quantity}, price_cents, ${now} FROM updated
      RETURNING id`;
    if (!rows.length)
      return json({ error: 'Bebida inválida ou estoque insuficiente.' }, 400);
    return json({ id: rows[0].id }, 201);
  }

  if (entity === 'expense') {
    const description = clean(body.description);
    const category = clean(body.category, 60);
    const payment = clean(body.payment, 40);
    const amountCents = positiveInt(body.amountCents);
    if (!description || !category || !payment || amountCents < 1)
      return json(
        {
          error:
            'Preencha a descrição e o valor e selecione categoria e pagamento.',
        },
        400,
      );
    const rows =
      await sql`INSERT INTO expenses (date, description, category, payment, amount_cents, created_at)
      VALUES (${clean(body.date, 10)}, ${description}, ${category}, ${payment}, ${amountCents}, ${now}) RETURNING id`;
    return json({ id: rows[0].id }, 201);
  }

  if (entity === 'monthlyCut') {
    const requestedMonth = clean(body.month, 7);
    const requestedStartDate = clean(body.startDate, 10);
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedStartDate)
      ? requestedStartDate
      : /^\d{4}-\d{2}$/.test(requestedMonth)
        ? `${requestedMonth}-01`
        : '';
    const month = /^\d{4}-\d{2}$/.test(requestedMonth)
      ? requestedMonth
      : startDate.slice(0, 7);
    const professionalInput = clean(body.professional, 30);
    const professionalKey = professionalInput
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const professional =
      professionalKey === 'flavio'
        ? 'Flávio'
        : professionalKey === 'fernando'
          ? 'Fernando'
          : professionalInput;
    const payment = clean(body.payment, 40);
    const client = clean(body.client);
    const cutsTotal = Math.max(1, positiveInt(body.cutsTotal));
    const cutsUsed = Math.min(cutsTotal, positiveInt(body.cutsUsed));
    if (
      !/^\d{4}-\d{2}$/.test(month) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !['Flávio', 'Fernando'].includes(professional) ||
      !payment ||
      !client
    ) {
      return json(
        {
          error:
            'Preencha cliente e data e selecione profissional e pagamento.',
        },
        400,
      );
    }
    const rows = await sql`INSERT INTO monthly_cuts
      (month, professional, payment, client, amount_cents, cuts_total, cuts_used, start_date, last_cut_date, time, created_at)
      VALUES (${month}, ${professional}, ${payment}, ${client}, ${positiveInt(body.amountCents)},
        ${cutsTotal}, ${cutsUsed}, ${startDate}, ${startDate}, ${clean(body.time, 5) || '00:00'}, ${now})
      RETURNING id`;
    return json({ id: rows[0].id }, 201);
  }

  return json({ error: 'Tipo de lançamento inválido.' }, 400);
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated(request)))
    return json({ error: 'Não autorizado.' }, 401);
  const body = (await request.json()) as Record<string, unknown>;
  const id = positiveInt(body.id);
  const entity = clean(body.entity, 30);
  const sql = await database();

  if (entity === 'monthlyCutUse') {
    const date = clean(body.date, 10);
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return json({ error: 'Plano mensal invÃ¡lido.' }, 400);
    const rows = await sql`UPDATE monthly_cuts SET
        cuts_used = LEAST(cuts_total, cuts_used + 1),
        last_cut_date = ${date}, time = ${clean(body.time, 5) || '00:00'}
      WHERE id = ${id} AND cuts_used < cuts_total RETURNING id, cuts_used`;
    if (!rows.length)
      return json(
        { error: 'Todos os cortes deste plano jÃ¡ foram usados.' },
        400,
      );
    return json({ id, cutsUsed: rows[0].cuts_used, updated: true });
  }

  if (entity === 'monthlyCut') {
    const requestedMonth = clean(body.month, 7);
    const requestedStartDate = clean(body.startDate, 10);
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedStartDate)
      ? requestedStartDate
      : /^\d{4}-\d{2}$/.test(requestedMonth)
        ? `${requestedMonth}-01`
        : '';
    const month = /^\d{4}-\d{2}$/.test(requestedMonth)
      ? requestedMonth
      : startDate.slice(0, 7);
    const professionalInput = clean(body.professional, 30);
    const professionalKey = professionalInput
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const professional =
      professionalKey === 'flavio'
        ? 'Flávio'
        : professionalKey === 'fernando'
          ? 'Fernando'
          : professionalInput;
    const payment = clean(body.payment, 40);
    const client = clean(body.client);
    const cutsTotal = Math.max(1, positiveInt(body.cutsTotal));
    const cutsUsed = Math.min(cutsTotal, positiveInt(body.cutsUsed));
    if (
      !id ||
      !/^\d{4}-\d{2}$/.test(month) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !['Flávio', 'Fernando'].includes(professional) ||
      !payment ||
      !client
    ) {
      return json(
        {
          error:
            'Preencha cliente e data e selecione profissional e pagamento.',
        },
        400,
      );
    }
    const rows = await sql`UPDATE monthly_cuts SET
        month = ${month}, professional = ${professional}, payment = ${payment}, client = ${client},
        amount_cents = ${positiveInt(body.amountCents)}, cuts_total = ${cutsTotal}, cuts_used = ${cutsUsed},
        start_date = ${startDate}, last_cut_date = ${clean(body.lastCutDate, 10) || startDate},
        time = ${clean(body.time, 5) || '00:00'}
      WHERE id = ${id} RETURNING id`;
    if (!rows.length)
      return json({ error: 'Plano mensal nÃ£o encontrado.' }, 404);
    return json({ id, updated: true });
  }

  const date = clean(body.date, 10);
  const professional = clean(body.professional, 30);
  const payment = clean(body.payment, 40);
  const service = clean(body.service);
  const amountCents = positiveInt(body.amountCents);
  const customAmount = body.customAmount === true;
  if (
    !id ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !['Flávio', 'Fernando'].includes(professional) ||
    !payment ||
    !service ||
    amountCents < 1
  ) {
    return json(
      {
        error:
          'Selecione profissional e pagamento e preencha serviço, data e valor.',
      },
      400,
    );
  }
  const rows = await sql`UPDATE appointments SET
      date = ${date}, professional = ${professional}, payment = ${payment},
      service = ${service}, client = ${clean(body.client) || 'Cliente'}, amount_cents = ${amountCents},
      custom_amount = ${customAmount},
      time = ${clean(body.time, 5) || '00:00'}
    WHERE id = ${id} RETURNING id`;
  if (!rows.length) return json({ error: 'Atendimento não encontrado.' }, 404);
  return json({ id, updated: true });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated(request)))
    return json({ error: 'Não autorizado.' }, 401);
  const url = new URL(request.url);
  const id = positiveInt(url.searchParams.get('id'));
  const entity = url.searchParams.get('entity');
  if (!id) return json({ error: 'Registro inválido.' }, 400);
  const sql = await database();

  if (entity === 'appointment') {
    await sql`DELETE FROM appointments WHERE id = ${id}`;
  } else if (entity === 'expense') {
    await sql`DELETE FROM expenses WHERE id = ${id}`;
  } else if (entity === 'beverageSale') {
    await sql`WITH deleted AS (
        DELETE FROM beverage_sales WHERE id = ${id} RETURNING product_id, quantity
      )
      UPDATE beverage_products AS product
      SET stock = product.stock + deleted.quantity
      FROM deleted WHERE product.id = deleted.product_id`;
  } else if (entity === 'monthlyCut') {
    await sql`DELETE FROM monthly_cuts WHERE id = ${id}`;
  } else {
    return json({ error: 'Tipo de registro inválido.' }, 400);
  }
  return json({ ok: true });
}
