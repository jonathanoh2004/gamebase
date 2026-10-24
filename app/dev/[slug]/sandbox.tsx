'use client';

import { type CSSProperties, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { toast } from '@/components/ui/toast';
import { BOARDS } from '@/games/client';
import { engineFor } from '@/games/engines';
import { SandboxSession } from '@/lib/client/sandbox-session';
import { PLAYER_COLORS } from '@/lib/db/schema';
import type { MatchPlayer } from '@/lib/server/rooms';

const newSeed = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

/** DEV ONLY: every seat on one screen, test bots, and a look at the full state. */
export function Sandbox({
  gameId,
  min,
  max,
  initialSeed,
}: {
  gameId: string;
  min: number;
  max: number;
  initialSeed: string;
}) {
  const engine = engineFor(gameId);
  const [players, setPlayers] = useState(Math.min(Math.max(4, min), max));
  const [seed, setSeed] = useState(initialSeed);
  const [follow, setFollow] = useState(true);
  const [auto, setAuto] = useState(false);
  const [showState, setShowState] = useState(false);
  const session = useMemo(
    () => (engine ? new SandboxSession(engine, players, seed) : null),
    [engine, players, seed],
  );
  const tick = useSyncExternalStore(
    (cb) => session?.subscribe(cb) ?? (() => {}),
    () => session?.currentVersion ?? 0,
    () => 0,
  );

  // Pass-and-play: the session hands the board to whoever acts next.
  useEffect(() => {
    session?.setFollow(follow);
  }, [session, follow]);

  useEffect(() => {
    if (!session || !auto) return;
    const t = setInterval(() => {
      void session.botMove().then((moved) => {
        if (!moved) setAuto(false);
      });
    }, 1400);
    return () => clearInterval(t);
  }, [session, auto]);

  if (!engine || !session) return <p className="p-6">Unknown game.</p>;
  const Board = BOARDS[gameId];
  const seats: MatchPlayer[] = Array.from({ length: players }, (_, seat) => ({
    seat,
    name: `Seat ${seat + 1}`,
    avatarSeed: `sandbox${seat}`,
    color: PLAYER_COLORS[seat % PLAYER_COLORS.length] ?? 'red',
    isYou: session.viewing === seat,
  }));
  const chip = (on: boolean) =>
    cn('label border px-2 py-1', on ? 'border-paper text-paper' : 'border-rule');

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-3 border border-rule px-4 py-3 text-sm"
        data-testid="sandbox-tools"
      >
        <div className="flex items-center gap-2">
          <span className="label">Table</span>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPlayers(n)}
                className={chip(n === players)}
              >
                {n}p
              </button>
            ))}
          </div>
          <Button size="sm" variant="quiet" onClick={() => setSeed(newSeed())}>
            New game
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="label">View as</span>
          <div className="flex flex-wrap gap-1">
            {seats.map((s) => (
              <button
                key={s.seat}
                type="button"
                onClick={() => {
                  setFollow(false);
                  session.setViewer(s.seat);
                }}
                className={cn(
                  chip(session.viewing === s.seat),
                  session.active.includes(s.seat) && 'text-yellow',
                )}
              >
                {s.seat + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setFollow(false);
                session.setViewer('spectator');
              }}
              className={chip(session.viewing === 'spectator')}
            >
              spectator
            </button>
          </div>
          <label className="flex items-center gap-2 text-dim">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            follow the turn
          </label>
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          <span className="label">Test bots</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => session.botMove().catch((e: Error) => toast(e.message, 'bad'))}
          >
            Bot move
          </Button>
          <Button size="sm" variant={auto ? 'primary' : 'ghost'} onClick={() => setAuto((a) => !a)}>
            {auto ? 'Stop' : 'Autoplay'}
          </Button>
        </div>
      </div>

      {Board && (
        <div style={{ '--board-chrome': '290px' } as CSSProperties}>
          <Board key={`${seed}-${players}`} session={session} players={seats} mode="sandbox" />
        </div>
      )}

      <section className="border border-rule p-4 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="label">
            Actions · v{tick} · seed {seed.slice(0, 12)}…
          </h2>
          <button
            type="button"
            className="label hover:text-paper"
            onClick={() => setShowState((s) => !s)}
          >
            {showState ? 'hide state' : 'full state'}
          </button>
        </div>
        {showState ? (
          <pre className="mt-3 max-h-96 overflow-auto bg-ink-1 p-2 text-[10px] text-dim">
            {JSON.stringify(session.fullState, null, 1)}
          </pre>
        ) : (
          <ol className="mt-3 max-h-48 space-y-1 overflow-auto font-mono text-[11px] text-dim">
            {[...session.log]
              .reverse()
              .slice(0, 60)
              .map((entry) => (
                <li key={entry.version}>
                  <span className="text-mute">
                    v{entry.version} · seat {entry.seat + 1}
                  </span>{' '}
                  {JSON.stringify(entry.action)}
                </li>
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}
