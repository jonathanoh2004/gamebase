import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { safeNextPath } from '@/lib/http/safe-redirect';
import { supabaseServer } from '@/lib/supabase/server';

// OAuth and magic-link landing (PKCE): trades the one-time code for a session
// cookie, then sends the user to a same-site path only.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  const fail = () => NextResponse.redirect(new URL('/signin?error=callback', url.origin), 303);

  if (env().GAMEBASE_BACKEND !== 'supabase' || !code || code.length > 512) return fail();
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail();
  return NextResponse.redirect(new URL(next, url.origin), 303);
}
