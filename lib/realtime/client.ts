'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ClientConfig } from '@/lib/env';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { type FxMessage, fxMessage, type PresenceEntry, presenceEntry } from './messages';

// One room's live channel (docs/DESIGN.md §4.2). Supabase in production; the
// dev server's event stream locally. Everything arriving here is a hint or
// decoration: the truth is always fetched over HTTPS.

export type ChannelStatus = 'connecting' | 'live' | 'down';

export interface ChannelHandlers {
  onLobby(version: number): void;
  onMatch(version: number): void;
  onPresence(entries: PresenceEntry[]): void;
  onFx(msg: FxMessage): void;
  onStatus(status: ChannelStatus): void;
}

export interface RoomChannel {
  sendFx(msg: FxMessage): void;
  close(): void;
}

const versionPayload = z.looseObject({ v: z.number().int().min(0) });

export function openRoomChannel(
  config: ClientConfig,
  roomId: string,
  me: { seat: number | null; name: string },
  h: ChannelHandlers,
): RoomChannel {
  return config.backend === 'local' ? openLocal(roomId, h) : openSupabase(config, roomId, me, h);
}

function openSupabase(
  config: ClientConfig,
  roomId: string,
  me: { seat: number | null; name: string },
  h: ChannelHandlers,
): RoomChannel {
  const supabase = supabaseBrowser(config);
  let channel: RealtimeChannel | null = null;
  let closed = false;
  h.onStatus('connecting');

  void (async () => {
    // Private channels authorize with the user's access token.
    await supabase.realtime.setAuth();
    if (closed) return;
    const ch = supabase.channel(`room:${roomId}`, {
      config: { private: true, broadcast: { self: false }, presence: { key: crypto.randomUUID() } },
    });
    channel = ch;
    ch.on('broadcast', { event: 'lobby' }, ({ payload }) => {
      const p = versionPayload.safeParse(payload);
      if (p.success) h.onLobby(p.data.v);
    })
      .on('broadcast', { event: 'match' }, ({ payload }) => {
        const p = versionPayload.safeParse(payload);
        if (p.success) h.onMatch(p.data.v);
      })
      .on('broadcast', { event: 'fx' }, ({ payload }) => {
        const p = fxMessage.safeParse(payload);
        if (p.success) h.onFx(p.data);
      })
      .on('presence', { event: 'sync' }, () => {
        const entries = Object.values(ch.presenceState())
          .flat()
          .map((e) => {
            const entry = e as Record<string, unknown>;
            return presenceEntry.safeParse({ seat: entry.seat ?? null, name: entry.name ?? '' });
          })
          .filter((r) => r.success)
          .map((r) => r.data);
        h.onPresence(entries);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          h.onStatus('live');
          void ch.track({ seat: me.seat, name: me.name });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          h.onStatus('down');
        }
      });
  })().catch(() => h.onStatus('down'));

  return {
    sendFx(msg) {
      void channel?.send({ type: 'broadcast', event: 'fx', payload: msg });
    },
    close() {
      closed = true;
      if (channel) void supabase.removeChannel(channel);
    },
  };
}

function openLocal(roomId: string, h: ChannelHandlers): RoomChannel {
  h.onStatus('connecting');
  const source = new EventSource(`/api/rooms/${roomId}/events`);
  const parse = (e: MessageEvent) => {
    try {
      return JSON.parse(e.data) as unknown;
    } catch {
      return null;
    }
  };
  source.addEventListener('ready', () => h.onStatus('live'));
  source.addEventListener('lobby', (e) => {
    const p = versionPayload.safeParse(parse(e as MessageEvent));
    if (p.success) h.onLobby(p.data.v);
  });
  source.addEventListener('match', (e) => {
    const p = versionPayload.safeParse(parse(e as MessageEvent));
    if (p.success) h.onMatch(p.data.v);
  });
  source.addEventListener('fx', (e) => {
    const p = fxMessage.safeParse(parse(e as MessageEvent));
    if (p.success) h.onFx(p.data);
  });
  source.addEventListener('presence', (e) => {
    const p = z.array(presenceEntry).safeParse(parse(e as MessageEvent));
    if (p.success) h.onPresence(p.data);
  });
  source.onerror = () =>
    h.onStatus(source.readyState === EventSource.CLOSED ? 'down' : 'connecting');
  return {
    sendFx(msg) {
      void fetch(`/api/rooms/${roomId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fx: msg }),
      }).catch(() => {});
    },
    close() {
      source.close();
    },
  };
}
