'use client';

import { type FormEvent, useState } from 'react';
import { ColorPicker } from '@/components/color-picker';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { toast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/client/api';
import type { PlayerColor } from '@/lib/db/schema';

export function ProfileForm({
  name: initialName,
  color: initialColor,
  avatarSeed,
  email,
  isOwner,
}: {
  name: string;
  color: PlayerColor;
  avatarSeed: string;
  email: string | null;
  isOwner: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/profile', { method: 'PATCH', body: { displayName: name, color } });
      toast('Saved.', 'good');
    } catch (err) {
      toast(
        err instanceof ApiError && err.status === 400
          ? "Letters, numbers, spaces and . _ ' - only (max 24)."
          : 'That didn’t save.',
        'bad',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api('/api/profile', { method: 'DELETE' });
      window.location.assign('/signin');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Couldn’t delete the account.', 'bad');
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={save} className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar seed={avatarSeed} color={color} size={64} />
          <div>
            <p className="font-bold text-2xl tracking-tight">{name || '—'}</p>
            {email && <p className="label mt-1 normal-case">{email} · only you see this</p>}
          </div>
        </div>
        <Field label="Display name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
        </Field>
        <div>
          <span className="label mb-2 block">Color</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <Button type="submit" disabled={busy}>
          Save
        </Button>
      </form>

      <div className="space-y-6">
        <section className="border border-rule p-4">
          <h2 className="label mb-2">Sessions</h2>
          <p className="mb-4 text-dim text-sm">
            Signs you out on every device, including this one.
          </p>
          <form action="/auth/signout?scope=global" method="post">
            <Button type="submit" variant="ghost">
              Sign out everywhere
            </Button>
          </form>
        </section>
        <section className="border border-red/40 p-4">
          <h2 className="label mb-2 text-red">Delete account</h2>
          <p className="mb-4 text-dim text-sm">
            Removes your login and profile. Past games keep a “Former player” in your seat.
          </p>
          <Button variant="danger" onClick={() => setConfirm(true)} disabled={isOwner}>
            {isOwner ? 'The owner can’t be deleted' : 'Delete my account'}
          </Button>
        </section>
      </div>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete your account?"
        description="This can’t be undone."
      >
        <div className="flex gap-2">
          <Button variant="danger" onClick={remove} disabled={busy}>
            Delete
          </Button>
          <Button variant="quiet" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
