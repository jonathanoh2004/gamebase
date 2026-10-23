import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

// LOCAL BACKEND ONLY: a signed cookie standing in for a Supabase session.
// lib/env refuses to start the local backend on a production deployment.

export const DEV_SESSION_COOKIE = 'gb_dev_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

interface Payload {
  sub: string;
  exp: number;
}

function secret(): string {
  const e = env();
  if (e.GAMEBASE_BACKEND !== 'local' || !e.DEV_AUTH_SECRET) {
    throw new Error('dev sessions are only available on the local backend');
  }
  return e.DEV_AUTH_SECRET;
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

export function createDevSessionToken(userId: string, now = Date.now()): string {
  const payload: Payload = { sub: userId, exp: Math.floor(now / 1000) + MAX_AGE_SECONDS };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function verifyDevSessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token || token.length > 512) return null;
  const [data, mac] = token.split('.');
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as Payload;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < now) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export const devSessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SECONDS,
};
