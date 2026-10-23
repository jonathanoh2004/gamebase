import 'server-only';
import { z } from 'zod';

/**
 * Server configuration, validated once on first use (not at import time, so
 * `next build` works without secrets). Secrets never carry the NEXT_PUBLIC_
 * prefix, so they can't be inlined into browser bundles.
 *
 * GAMEBASE_BACKEND:
 *   supabase  production and previews: Supabase Auth + Realtime.
 *   local     development and tests: local Postgres, dev sign-in, SSE realtime.
 *             Refused outright on a Vercel production deployment.
 */
const schema = z
  .object({
    GAMEBASE_BACKEND: z.enum(['supabase', 'local']).default('supabase'),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL'),
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
    SUPABASE_SECRET_KEY: z.string().min(20).optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(32).optional(),
    DEV_AUTH_SECRET: z.string().min(32).optional(),
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.GAMEBASE_BACKEND === 'local') {
      if (v.VERCEL_ENV === 'production') {
        ctx.addIssue({
          code: 'custom',
          path: ['GAMEBASE_BACKEND'],
          message: 'the local backend (dev sign-in) can never run in production',
        });
      }
      if (!v.DEV_AUTH_SECRET) {
        ctx.addIssue({ code: 'custom', path: ['DEV_AUTH_SECRET'], message: 'required locally' });
      }
    } else {
      for (const key of [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        'SUPABASE_SECRET_KEY',
      ] as const) {
        if (!v[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required' });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Name the bad keys, never their values.
    const keys = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid server configuration:\n  ${keys.join('\n  ')}`);
  }
  cached = parsed.data;
  return cached;
}

export const isLocalBackend = () => env().GAMEBASE_BACKEND === 'local';

/** Settings the browser needs. Everything here is public by design. */
export interface ClientConfig {
  backend: 'supabase' | 'local';
  supabaseUrl: string | null;
  supabaseKey: string | null;
  turnstileSiteKey: string | null;
}

export function clientConfig(): ClientConfig {
  const e = env();
  return {
    backend: e.GAMEBASE_BACKEND,
    supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL ?? null,
    supabaseKey: e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null,
    turnstileSiteKey: e.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
  };
}
