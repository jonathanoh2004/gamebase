import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/wordmark';
import { DEV_USERS } from '@/lib/auth/dev-users';
import { getSessionUser } from '@/lib/auth/session';
import { isLocalBackend } from '@/lib/env';
import { safeNextPath } from '@/lib/http/safe-redirect';
import { SignInClient } from './sign-in-client';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage(props: PageProps<'/signin'>) {
  const params = await props.searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
  if (await getSessionUser()) redirect(next);
  const failed = params.error === 'callback';

  return (
    <main className="grid-paper grid min-h-dvh lg:grid-cols-[1.25fr_1fr]">
      <section className="flex flex-col justify-between gap-12 p-6 sm:p-10 lg:p-16">
        <span className="label">01 · Invite only</span>
        <div>
          <Wordmark />
          <p className="mt-8 max-w-md text-dim text-lg leading-relaxed">
            Board games with friends, rebuilt for the screen. Every roll, hop and payout, animated.
          </p>
        </div>
        <span className="label">Gamebase · friends only · v0.1</span>
      </section>
      <section className="flex items-center border-rule bg-ink-0/80 p-6 sm:p-10 lg:border-l">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-bold text-3xl tracking-tight">Sign in</h1>
          <p className="mt-2 mb-8 text-dim text-sm">
            New here? You’ll need an invite link from a member.
          </p>
          {failed && (
            <p className="mb-6 border border-red/60 px-4 py-3 text-sm" role="alert">
              That sign-in link didn’t work or has expired. Try again.
            </p>
          )}
          <SignInClient
            next={next}
            devUsers={
              isLocalBackend()
                ? DEV_USERS.map((u) => ({ key: u.key, name: u.name, role: u.role }))
                : null
            }
          />
        </div>
      </section>
    </main>
  );
}
