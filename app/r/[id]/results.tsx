'use client';

import { animate, stagger } from 'animejs';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/client/api';
import type { RoomController } from '@/lib/client/room-controller';
import { useReducedMotion } from '@/lib/motion/reduced';
import { useAnimeScope } from '@/lib/motion/use-scope';
import type { RoomView } from '@/lib/server/rooms';

export function Results({ room, controller }: { room: RoomView; controller: RoomController }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const outcome = room.match?.outcome;

  useAnimeScope(root, () => {
    if (reduced || !root.current) return;
    animate(root.current.querySelectorAll('[data-standing]'), {
      opacity: [0, 1],
      x: [-20, 0],
      duration: 520,
      ease: 'out(3)',
      delay: stagger(90, { start: 200 }),
    });
  }, [reduced, outcome]);

  if (!outcome || !room.match) return null;
  const players = room.match.players;
  const sorted = [...outcome.standings].sort((a, b) => a.rank - b.rank || b.score - a.score);

  const rematch = async () => {
    setBusy(true);
    try {
      await controller.lobby({ type: 'rematch' });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Couldn’t start a rematch.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section ref={root} className="border border-rule bg-ink-1" data-testid="results">
      <header className="flex items-center justify-between border-rule border-b px-4 py-3">
        <span className="label">Final standings</span>
        <span className="label">{outcome.summary}</span>
      </header>
      <ol>
        {sorted.map((s) => {
          const p = players[s.seat];
          return (
            <li
              key={s.seat}
              data-standing
              className="grid grid-cols-[3rem_auto_1fr_auto] items-center gap-4 border-rule border-b px-4 py-3 last:border-b-0"
            >
              <span
                className={`font-extrabold text-2xl ${s.rank === 1 ? 'text-yellow' : 'text-mute'}`}
              >
                {s.rank}
              </span>
              {p && <Avatar seed={p.avatarSeed} color={p.color} size={32} />}
              <span className="font-bold">
                {p?.name ?? `Seat ${s.seat + 1}`}
                {p?.isYou && <span className="label ml-2">you</span>}
              </span>
              <span className="font-mono text-lg">{s.score}</span>
            </li>
          );
        })}
      </ol>
      <footer className="flex flex-wrap gap-3 border-rule border-t px-4 py-3">
        {room.you.isHost ? (
          <Button onClick={rematch} disabled={busy}>
            Rematch
          </Button>
        ) : (
          <span className="label self-center">Waiting for the host to start a rematch</span>
        )}
        <Link href="/" className="label self-center px-3 hover:text-paper">
          Back to the library
        </Link>
      </footer>
    </section>
  );
}
