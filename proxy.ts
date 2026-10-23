import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { buildCsp, newNonce } from '@/lib/security/csp';

// Runs before every page and API request:
//   1. a fresh CSP nonce per page view (Next.js applies it to its scripts),
//   2. on the Supabase backend, a session refresh so expired access tokens
//      are renewed before any server code verifies them.
// Authorization is NOT decided here; every page and route checks it where the
// data is read (docs/DESIGN.md §8.3).

interface PendingCookie {
  name: string;
  value: string;
  options: Parameters<NextResponse['cookies']['set']>[2];
}

export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  const backend = process.env.GAMEBASE_BACKEND === 'local' ? 'local' : 'supabase';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const pending: PendingCookie[] = [];
  const cacheHeaders: Record<string, string> = {};
  if (backend === 'supabase' && supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list, headers) => {
          for (const { name, value, options } of list) {
            request.cookies.set(name, value);
            pending.push({ name, value, options });
          }
          Object.assign(cacheHeaders, headers);
        },
      },
    });
    // Verifies and, if needed, refreshes the session; cookies land in `pending`.
    await supabase.auth.getClaims();
  }

  const nonce = newNonce();
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === 'development',
    supabaseUrl: backend === 'supabase' ? supabaseUrl : null,
    turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  });

  const headers = new Headers(request.headers);
  if (!isApi) {
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
  }
  const response = NextResponse.next({ request: { headers } });
  if (!isApi) response.headers.set('Content-Security-Policy', csp);
  for (const { name, value, options } of pending) response.cookies.set(name, value, options);
  for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
