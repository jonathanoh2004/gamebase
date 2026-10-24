'use client';

import { type FormEvent, useState } from 'react';
import { ColorPicker } from '@/components/color-picker';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ApiError, api } from '@/lib/client/api';
import type { PlayerColor } from '@/lib/db/schema';

export function WelcomeForm({
  next,
  suggested,
  avatarSeed,
  color: initialColor,
}: {
  next: string;
  suggested: string;
  avatarSeed: string;
  color: PlayerColor;
}) {
  const [name, setName] = useState(suggested);
  const [color, setColor] = useState(initialColor);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/profile', { method: 'PATCH', body: { displayName: name, color } });
      window.location.assign(next);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? "Letters, numbers, spaces and . _ ' - only (max 24)."
          : 'That didn’t save. Try again.',
      );
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar seed={avatarSeed} color={color} size={56} />
        <span className="font-bold text-2xl tracking-tight">{name || 'Your name'}</span>
      </div>
      <Field
        label="Display name"
        hint="Other players only ever see this name, your avatar and your color."
        error={error}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          required
          autoFocus
          data-testid="display-name"
        />
      </Field>
      <div>
        <span className="label mb-2 block">Color</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy || !name.trim()}>
        {busy ? 'Saving…' : 'Let’s play'}
      </Button>
    </form>
  );
}
