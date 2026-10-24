import type { ReactNode } from 'react';

/** A centered single-message page (pending, revoked, expired links). */
export function SimplePage({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="grid-paper flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md border border-rule bg-ink-1 p-8">
        <span className="label">{index}</span>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">{title}</h1>
        <div className="mt-4 space-y-4 text-dim">{children}</div>
      </div>
    </main>
  );
}

export function SignOutButton({ label = 'Sign out' }: { label?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="font-mono text-[12px] text-paper uppercase tracking-[0.08em] underline-offset-4 hover:underline"
      >
        {label}
      </button>
    </form>
  );
}
