import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { env } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';
import { DEV_SESSION_COOKIE, verifyDevSessionToken } from './dev-session';

export interface SessionUser {
  id: string;
  email: string | null;
  /** A name the identity provider suggested; only ever shown back to its owner. */
  suggestedName: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The verified identity behind this request, or null. Supabase tokens are
 * verified with getClaims() (signature and expiry), never trusted from the
 * cookie as-is. Memoized per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (env().GAMEBASE_BACKEND === 'local') {
    const store = await cookies();
    const id = verifyDevSessionToken(store.get(DEV_SESSION_COOKIE)?.value);
    return id && UUID.test(id) ? { id, email: null, suggestedName: null } : null;
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims) return null;
  if (claims.role !== 'authenticated' || claims.is_anonymous === true) return null;
  if (typeof claims.sub !== 'string' || !UUID.test(claims.sub)) return null;

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const pick = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : null);
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    suggestedName: pick('full_name') ?? pick('name') ?? pick('user_name'),
  };
});
