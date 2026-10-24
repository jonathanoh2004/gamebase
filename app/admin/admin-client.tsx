'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/client/api';
import type { PlayerColor, Role } from '@/lib/db/schema';

interface Member {
  id: string;
  name: string;
  avatarSeed: string;
  color: PlayerColor;
  role: Role;
  createdAt: string;
}

interface OpenInvite {
  id: string;
  createdBy: string;
  expiresAt: string;
}

export function AdminClient({ members, invites }: { members: Member[]; invites: OpenInvite[] }) {
  const [rows, setRows] = useState(members);
  const [open, setOpen] = useState(invites);
  const [link, setLink] = useState<string | null>(null);

  const act = async (id: string, action: 'revoke' | 'restore') => {
    try {
      await api(`/api/admin/members/${id}`, { body: { action } });
      setRows((r) =>
        r.map((m) =>
          m.id === id ? { ...m, role: action === 'revoke' ? 'revoked' : 'member' } : m,
        ),
      );
      toast(action === 'revoke' ? 'Access revoked.' : 'Access restored.', 'good');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That didn’t work.', 'bad');
    }
  };

  const revokeInvite = async (id: string) => {
    try {
      await api(`/api/admin/invites/${id}`, { method: 'DELETE' });
      setOpen((o) => o.filter((i) => i.id !== id));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That didn’t work.', 'bad');
    }
  };

  const newInvite = async () => {
    try {
      const { path } = await api<{ path: string }>('/api/invites', { body: { roomId: null } });
      setLink(`${window.location.origin}${path}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Couldn’t create an invite.', 'bad');
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <section className="border border-rule">
        <header className="flex items-center justify-between border-rule border-b px-4 py-3">
          <span className="label">Members · {rows.filter((r) => r.role !== 'revoked').length}</span>
        </header>
        <ul>
          {rows.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 border-rule border-b px-4 py-3 last:border-b-0"
            >
              <Avatar seed={m.avatarSeed} color={m.color} size={28} />
              <span className="min-w-0 flex-1 truncate font-bold">{m.name || '(no name yet)'}</span>
              <span
                className={`label ${m.role === 'revoked' ? 'text-red' : m.role === 'owner' ? 'text-yellow' : ''}`}
              >
                {m.role}
              </span>
              {m.role === 'member' && (
                <Button size="sm" variant="danger" onClick={() => act(m.id, 'revoke')}>
                  Revoke
                </Button>
              )}
              {m.role === 'revoked' && (
                <Button size="sm" variant="ghost" onClick={() => act(m.id, 'restore')}>
                  Restore
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div className="border border-rule p-4">
          <h2 className="label mb-3">New invite</h2>
          <p className="mb-4 text-dim text-sm">
            A one-time link that makes one person a member. Expires in 48 hours.
          </p>
          <Button onClick={newInvite}>Create invite link</Button>
          {link && (
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="mt-4 h-10 w-full border border-rule-strong bg-ink-0 px-3 font-mono text-dim text-xs"
            />
          )}
        </div>
        <div className="border border-rule">
          <header className="border-rule border-b px-4 py-3">
            <span className="label">Open invites · {open.length}</span>
          </header>
          <ul>
            {open.length === 0 && <li className="px-4 py-3 text-mute text-sm">None.</li>}
            {open.map((i) => (
              <li
                key={i.id}
                className="flex items-center gap-3 border-rule border-b px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  from {i.createdBy || 'a member'}
                </span>
                <span className="label">until {new Date(i.expiresAt).toLocaleString()}</span>
                <Button size="sm" variant="quiet" onClick={() => revokeInvite(i.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
