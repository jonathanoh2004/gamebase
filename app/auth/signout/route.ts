import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { DEV_SESSION_COOKIE } from '@/lib/auth/dev-session';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/http/errors';
import { assertSameOrigin } from '@/lib/http/route';
import { supabaseServer } from '@/lib/supabase/server';

// POST only (a GET link could be triggered by any page). `?scope=global` signs
// out every device.
export async function POST(request: Request) {
  const url = new URL(request.url);
  try {
    assertSameOrigin(request);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 403;
    return new NextResponse(null, { status });
  }
  const scope = url.searchParams.get('scope') === 'global' ? 'global' : 'local';
  if (env().GAMEBASE_BACKEND === 'local') {
    (await cookies()).delete(DEV_SESSION_COOKIE);
  } else {
    await (await supabaseServer()).auth.signOut({ scope });
  }
  return NextResponse.redirect(new URL('/signin', url.origin), 303);
}
