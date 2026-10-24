'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/client/api';

export function CreateRoom({ gameId }: { gameId: string }) {
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const { roomId } = await api<{ roomId: string }>('/api/rooms', {
        body: { gameId, options: {} },
      });
      window.location.assign(`/r/${roomId}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Couldn’t open a room.', 'bad');
      setBusy(false);
    }
  };
  return (
    <Button size="lg" onClick={create} disabled={busy} data-testid="create-room">
      {busy ? 'Opening…' : 'Create room'}
    </Button>
  );
}
