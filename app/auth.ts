import { env } from 'cloudflare:workers';

export const SESSION_COOKIE = 'barbearia_session';

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sessionToken() {
  const pin = String(env.SITE_PIN ?? '');
  const secret = String(env.SITE_SESSION_SECRET ?? '');
  if (!pin || !secret) return '';
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${pin}:${secret}`)));
}

export async function validPin(pin: string) {
  const supplied = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin)));
  const expected = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(env.SITE_PIN ?? ''))));
  return supplied === expected && Boolean(env.SITE_PIN);
}

export async function isAuthenticated(request: Request) {
  const value = request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1) ?? '';
  const expected = await sessionToken();
  return Boolean(expected) && value === expected;
}

export async function createSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${await sessionToken()}; HttpOnly; SameSite=Strict; Path=/${secure}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
