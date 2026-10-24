import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { safeNextPath } from '@/lib/http/safe-redirect';
import { supabaseServer } from '@/lib/supabase/server';

const TOKEN = /^[A-Za-z0-9_-]{1,512}$/;
// Sign-in links only: no password recovery or email changes come through here.
const EMAIL_TYPES = new Set(['email', 'magiclink', 'signup']);

// Sign-in landing. Two shapes arrive here:
//   ?code=…          OAuth (and magic links opened in the browser that asked
//                    for them): the PKCE code is traded for a session.
//   ?token_hash=…    magic links from the email template in docs/SETUP.md,
//                    which work on any device: verified server-side.
// Either way the user then goes to a same-site path only.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = safeNextPath(url.searchParams.get('next'));
  const fail = () => NextResponse.redirect(new URL('/signin?error=callback', url.origin), 303);

  if (env().GAMEBASE_BACKEND !== 'supabase') return fail();
  const supabase = await supabaseServer();
  if (code && TOKEN.test(code)) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail();
  } else if (tokenHash && TOKEN.test(tokenHash) && type && EMAIL_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) return fail();
  } else {
    return fail();
  }
  return NextResponse.redirect(new URL(next, url.origin), 303);
}
