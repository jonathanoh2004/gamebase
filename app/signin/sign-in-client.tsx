'use client';

import { type FormEvent, useState } from 'react';
import { useClientConfig } from '@/components/providers';
import { Turnstile } from '@/components/turnstile';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api } from '@/lib/client/api';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function SignInClient({
  next,
  devUsers,
}: {
  next: string;
  devUsers: { key: string; name: string; role: string }[] | null;
}) {
  const config = useClientConfig();
  return config.backend === 'local' && devUsers ? (
    <DevSignIn next={next} users={devUsers} />
  ) : (
    <SupabaseSignIn next={next} />
  );
}

function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

function SupabaseSignIn({ next }: { next: string }) {
  const config = useClientConfig();
  const [email, setEmail] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const oauth = async (provider: 'discord' | 'google') => {
    setError(null);
    const { error } = await supabaseBrowser(config).auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl(next) },
    });
    if (error) setError('That didn’t work. Try again in a moment.');
  };

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    if (config.turnstileSiteKey && !captcha) return setError('Finish the check below first.');
    setState('sending');
    setError(null);
    const { error } = await supabaseBrowser(config).auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl(next),
        shouldCreateUser: true,
        captchaToken: captcha ?? undefined,
      },
    });
    if (error) {
      setState('error');
      setError('We couldn’t send that link. Check the address and try again.');
    } else setState('sent');
  };

  const methods = new Set(config.signInMethods);
  const oauthCount = Number(methods.has('discord')) + Number(methods.has('google'));

  return (
    <div className="space-y-6">
      {oauthCount > 0 && (
        <div className="grid gap-2">
          {methods.has('discord') && (
            <Button size="lg" onClick={() => oauth('discord')}>
              Continue with Discord
            </Button>
          )}
          {methods.has('google') && (
            <Button
              size="lg"
              variant={methods.has('discord') ? 'ghost' : 'primary'}
              onClick={() => oauth('google')}
            >
              Continue with Google
            </Button>
          )}
        </div>
      )}
      {oauthCount > 0 && methods.has('email') && (
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-rule" />
          <span className="label">or email</span>
          <span className="h-px flex-1 bg-rule" />
        </div>
      )}
      {!methods.has('email') ? null : state === 'sent' ? (
        <p className="border border-green/50 px-4 py-3 text-sm">
          Check your inbox: we sent a sign-in link to <strong>{email}</strong>.
        </p>
      ) : (
        <form onSubmit={sendLink} className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={254}
            />
          </Field>
          {config.turnstileSiteKey && (
            <Turnstile siteKey={config.turnstileSiteKey} onToken={setCaptcha} />
          )}
          <Button type="submit" variant="ghost" className="w-full" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Email me a link'}
          </Button>
        </form>
      )}
      {error && (
        <p className="text-red text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DevSignIn({
  next,
  users,
}: {
  next: string;
  users: { key: string; name: string; role: string }[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const signIn = async (key: string) => {
    setBusy(key);
    try {
      await api('/api/dev/session', { body: { user: key } });
      window.location.assign(next);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-4">
      <p className="label text-yellow">Local backend · dev sign-in</p>
      <div className="grid grid-cols-3 gap-2">
        {users.map((u) => (
          <button
            key={u.key}
            type="button"
            disabled={busy !== null}
            onClick={() => signIn(u.key)}
            data-testid={`dev-user-${u.key}`}
            className="flex flex-col items-start gap-1 border border-rule-strong px-3 py-3 text-left hover:border-paper disabled:opacity-50"
          >
            <span className="font-bold">{u.name || u.key}</span>
            <span className="label">{u.role}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
