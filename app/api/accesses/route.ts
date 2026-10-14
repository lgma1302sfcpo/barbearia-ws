import { isAuthenticated } from '@/app/auth';
import { ensureSchema, getSql } from '@/db/postgres';
import { describeDevice } from '@/lib/access-device';

export const runtime = 'nodejs';
const VISITOR_COOKIE = 'barbearia_visitor';

function visitorId(request: Request) {
  const value = request.headers.get('cookie')?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1);
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value : null;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    await ensureSchema();
    const sql = getSql();
    const id = visitorId(request) ?? crypto.randomUUID();
    const { device, browser } = describeDevice((request.headers.get('user-agent') ?? '').slice(0, 1000));
    await sql`INSERT INTO access_visitors (id, device, browser)
      VALUES (${id}, ${device}, ${browser})
      ON CONFLICT (id) DO UPDATE SET
        device = EXCLUDED.device, browser = EXCLUDED.browser, last_access = NOW()`;
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

export async function GET(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    await ensureSchema();
    const sql = getSql();
    const visitors = await sql`SELECT id, device, browser, first_access, last_access
      FROM access_visitors ORDER BY last_access DESC`;
    return Response.json({ visitors, currentVisitorId: visitorId(request) }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Não foi possível carregar os acessos.' }, { status: 503 });
  }
}
