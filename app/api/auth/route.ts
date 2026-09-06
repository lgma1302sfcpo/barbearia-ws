import { clearSessionCookie, createSessionCookie, isAuthenticated, validPin } from '@/app/auth';

export async function GET(request: Request) {
  return Response.json({ authenticated: await isAuthenticated(request) });
}

export async function POST(request: Request) {
  const body = await request.json() as { pin?: unknown };
  if (!(await validPin(String(body.pin ?? '')))) return Response.json({ error: 'PIN incorreto.' }, { status: 401 });
  return Response.json({ authenticated: true }, { headers: { 'Set-Cookie': await createSessionCookie(request) } });
}

export async function DELETE() {
  return Response.json({ authenticated: false }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}
