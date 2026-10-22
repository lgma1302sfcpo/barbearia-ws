import { isAuthenticated } from '@/app/auth';
import { ensureSchema, getSql } from '@/db/postgres';
import { describeDevice } from '@/lib/access-device';

export const runtime = 'nodejs';
const VISITOR_COOKIE = 'barbearia_visitor';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function visitorId(request: Request) {
  const value = request.headers.get('cookie')?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1);
  return value && UUID.test(value) ? value : null;
}

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function header(request: Request, name: string) {
  const value = request.headers.get(name);
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// cidade aproximada pelo IP (a Vercel envia esses cabeçalhos em produção)
function location(request: Request) {
  const city = header(request, 'x-vercel-ip-city');
  const region = header(request, 'x-vercel-ip-country-region');
  const country = header(request, 'x-vercel-ip-country');
  return [city, region, country && country !== 'BR' ? country : ''].filter(Boolean).join(', ') || null;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    await ensureSchema();
    const sql = getSql();
    const id = visitorId(request) ?? crypto.randomUUID();
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const screen = /^\d{2,5}x\d{2,5}$/.test(String(body.screen)) ? String(body.screen) : undefined;
    const { device, browser, model } = describeDevice(
      (request.headers.get('user-agent') ?? '').slice(0, 1000),
      { model: text(body.model, 80), platformVersion: text(body.platformVersion, 20), screen },
    );
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) || null;
    await sql`INSERT INTO access_visitors (id, device, browser, model, screen, location, ip)
      VALUES (${id}, ${device}, ${browser}, ${model || null}, ${screen ?? null}, ${location(request)}, ${ip})
      ON CONFLICT (id) DO UPDATE SET
        device = EXCLUDED.device, browser = EXCLUDED.browser, model = EXCLUDED.model,
        screen = EXCLUDED.screen, location = EXCLUDED.location, ip = EXCLUDED.ip, last_access = NOW()`;
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return Response.json({ recorded: true }, {
      headers: {
        'Set-Cookie': `${VISITOR_COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secure}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ error: 'Não foi possível registrar o acesso.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null;
  if (!id) return Response.json({ error: 'Visitante inválido.' }, { status: 400 });
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`UPDATE access_visitors SET label = ${text(body.label, 60) ?? null} WHERE id = ${id}`;
    return Response.json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Não foi possível salvar o nome.' }, { status: 503 });
  }
}

export async function GET(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    await ensureSchema();
    const sql = getSql();
    const visitors = await sql`SELECT id, label, device, browser, model, screen, location, ip,
        first_access, last_access
      FROM access_visitors ORDER BY last_access DESC`;
    return Response.json({ visitors, currentVisitorId: visitorId(request) }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Não foi possível carregar os acessos.' }, { status: 503 });
  }
}
