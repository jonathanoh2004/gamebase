'use client';

import { type AutoLayout, createLayout } from 'animejs';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from 'zustand';
import { ColorPicker } from '@/components/color-picker';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/dialog';
import { ColorGlyph } from '@/components/ui/glyph';
import { toast } from '@/components/ui/toast';
import { OPTIONS } from '@/games/client';
import { ApiError, api } from '@/lib/client/api';
import type { RoomController } from '@/lib/client/room-controller';
import type { PlayerColor } from '@/lib/db/schema';
import { useReducedMotion } from '@/lib/motion/reduced';
import type { LobbyCommand, RoomView, SeatView } from '@/lib/server/rooms';

export function Lobby({ room, controller }: { room: RoomView; controller: RoomController }) {
  const presence = useStore(controller.store, (s) => s.presence);
  const [busy, setBusy] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const run = async (command: LobbyCommand, key: string = command.type) => {
    setBusy(key);
    try {
      const res = await controller.lobby(command);
      if ('closed' in res || 'left' in res) {
        if ('closed' in res) window.location.assign('/');
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That didn’t work.', 'bad');
    } finally {
      setBusy(null);
    }
  };

  const createInvite = async () => {
    setBusy('invite');
    try {
      const { path } = await api<{ path: string }>('/api/invites', { body: { roomId: room.id } });
      setInvite(`${window.location.origin}${path}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Couldn’t create an invite.', 'bad');
    } finally {
      setBusy(null);
    }
  };

  const me = room.seats.find((s) => s.isYou);
  const presentSeats = new Set(presence.map((p) => p.seat));
  const everyoneReady = room.seats.every((s) => s.ready || s.isHost);
  const enough = room.seats.length >= room.players.min;
  const Options = OPTIONS[room.gameId];
  const roomLink = origin ? `${origin}/r/${room.id}` : '';

  return (
    <div className="grid gap-6 pt-6 lg:grid-cols-[1fr_360px]">
      <section aria-label="Seats">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">
            01 · Seats {room.seats.length}/{room.players.max}
          </h2>
          {room.locked && <span className="label text-orange">locked</span>}
        </div>
        <SeatGrid
          seats={room.seats}
          max={room.players.max}
          present={presentSeats}
          isHost={room.you.isHost}
          animate={!reduced}
          onKick={(seat) => run({ type: 'kick', seat }, `kick-${seat}`)}
        />
      </section>

      <aside className="space-y-4">
        <div className="border border-rule bg-ink-1 p-4">
          <h2 className="label mb-4">02 · You</h2>
          {me ? (
            <div className="space-y-4">
              <ColorPicker
                value={me.color}
                taken={room.seats.map((s) => s.color)}
                disabled={busy !== null}
                onChange={(color: PlayerColor) => run({ type: 'color', color }, 'color')}
              />
              <div className="flex flex-wrap gap-2">
                {!me.isHost && (
                  <Button
                    variant={me.ready ? 'ghost' : 'primary'}
                    onClick={() => run({ type: 'ready', ready: !me.ready })}
                    disabled={busy !== null}
                    data-testid="ready"
                  >
                    {me.ready ? 'Not ready' : 'I’m ready'}
                  </Button>
                )}
                <Button
                  variant="quiet"
                  onClick={() => run({ type: 'leave' })}
                  disabled={busy !== null}
                >
                  Leave seat
                </Button>
              </div>
            </div>
          ) : room.you.canJoin ? (
            <Button
              onClick={() => run({ type: 'join' })}
              disabled={busy !== null}
              data-testid="join"
            >
              Take a seat
            </Button>
          ) : (
            <p className="text-mute text-sm">
              {room.locked ? 'The host locked this room.' : 'This room is full.'}
            </p>
          )}
        </div>

        <div className="border border-rule bg-ink-1 p-4">
          <h2 className="label mb-4">03 · Invite</h2>
          <div className="space-y-3">
            <CopyLine label="Room link (members)" value={roomLink} />
            <Button
              variant="ghost"
              className="w-full"
              onClick={createInvite}
              disabled={busy !== null || !me}
            >
              Invite someone new
            </Button>
          </div>
        </div>

        {(room.you.isHost || Options) && (
          <div className="border border-rule bg-ink-1 p-4">
            <h2 className="label mb-4">04 · {room.you.isHost ? 'Host' : 'Settings'}</h2>
            <div className="space-y-4">
              {Options && (
                <Options
                  options={room.options}
                  editable={room.you.isHost && busy === null}
                  onChange={(options) => run({ type: 'options', options }, 'options')}
                />
              )}
              {room.you.isHost && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => run({ type: 'lock', locked: !room.locked })}
                    >
                      {room.locked ? 'Unlock room' : 'Lock room'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => run({ type: 'spectators', allow: !room.allowSpectators })}
                    >
                      {room.allowSpectators ? 'No spectators' : 'Allow spectators'}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => run({ type: 'close' })}>
                      Close room
                    </Button>
                  </div>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => run({ type: 'start' })}
                    disabled={busy !== null || !enough || !everyoneReady}
                    data-testid="start"
                  >
                    {!enough
                      ? `Needs ${room.players.min - room.seats.length} more`
                      : !everyoneReady
                        ? 'Waiting for ready'
                        : 'Start game'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </aside>

      <Dialog
        open={invite !== null}
        onOpenChange={(open) => !open && setInvite(null)}
        title="One-time invite"
        description="Send this to one friend. It works once, for 48 hours, and drops them into this room."
      >
        {invite && <CopyLine label="Invite link" value={invite} testId="invite-link" />}
      </Dialog>
    </div>
  );
}

function SeatGrid({
  seats,
  max,
  present,
  isHost,
  animate,
  onKick,
}: {
  seats: SeatView[];
  max: number;
  present: Set<number | null>;
  isHost: boolean;
  animate: boolean;
  onKick: (seat: number) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const layout = useRef<AutoLayout | null>(null);
  const [shown, setShown] = useState(seats);

  useLayoutEffect(() => {
    if (!grid.current) return;
    layout.current = createLayout(grid.current, {
      children: '[data-seat]',
      duration: 460,
      ease: 'out(3)',
      enterFrom: { opacity: 0, scale: 0.92 },
      leaveTo: { opacity: 0, scale: 0.92 },
    });
    return () => {
      layout.current?.revert();
      layout.current = null;
    };
  }, []);

  // Seats morph into place when people join, leave or switch colors.
  useEffect(() => {
    const l = layout.current;
    if (!l || !animate) {
      setShown(seats);
      return;
    }
    queueMicrotask(() => l.update(() => flushSync(() => setShown(seats))));
  }, [seats, animate]);

  const empty = Math.max(0, max - shown.length);
  return (
    <div ref={grid} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {shown.map((s) => (
        <div
          key={`seat-${s.seat}`}
          data-seat
          data-testid={`seat-${s.seat}`}
          className={cn(
            'relative flex min-h-36 flex-col justify-between border bg-ink-1 p-3',
            s.isYou ? 'border-paper' : 'border-rule',
          )}
        >
          <div className="flex items-start justify-between">
            <Avatar seed={s.avatarSeed} color={s.color} size={40} />
            <span className="flex items-center gap-1.5">
              {present.has(s.seat) && (
                <span className="size-1.5 rounded-full bg-green" title="online" />
              )}
              <ColorGlyph color={s.color} size={16} />
            </span>
          </div>
          <div>
            <p className="truncate font-bold">{s.name}</p>
            <p className="label mt-1">
              {s.isHost ? (
                'host'
              ) : s.ready ? (
                <span className="text-green">ready</span>
              ) : (
                'not ready'
              )}
              {s.isYou && ' · you'}
            </p>
          </div>
          {isHost && !s.isYou && (
            <button
              type="button"
              onClick={() => onKick(s.seat)}
              className="label absolute right-2 bottom-2 hover:text-red"
              aria-label={`Remove ${s.name}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: interchangeable empty seats
          key={`empty-${i}`}
          className="flex min-h-36 items-end border border-rule border-dashed p-3"
        >
          <span className="label">Open seat</span>
        </div>
      ))}
    </div>
  );
}

function CopyLine({ label, value, testId }: { label: string; value: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <span className="label mb-1 block">{label}</span>
      <div className="flex">
        <input
          readOnly
          value={value}
          data-testid={testId}
          onFocus={(e) => e.target.select()}
          className="h-10 min-w-0 flex-1 border border-rule-strong bg-ink-0 px-3 font-mono text-dim text-xs"
        />
        <button
          type="button"
          className="label h-10 border border-rule-strong border-l-0 px-3 hover:text-paper"
          onClick={async () => {
            await navigator.clipboard?.writeText(value).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
    </div>
  );
}
