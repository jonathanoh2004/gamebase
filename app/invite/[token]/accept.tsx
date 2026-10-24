'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, api } from '@/lib/client/api';

export function AcceptInvite({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const { roomId } = await api<{ roomId: string | null }>('/api/invites/redeem', {
        body: { token },
      });
      window.location.assign(roomId ? `/r/${roomId}` : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That didn’t work. Try again.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <Button
        size="lg"
        className="w-full"
        onClick={accept}
        disabled={busy}
        data-testid="accept-invite"
      >
        {busy ? 'Joining…' : 'Accept invite'}
      </Button>
      {error && (
        <p className="text-red text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
