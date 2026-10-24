'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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
export function Sandbox({ gameId, min, max }: { gameId: string; min: number; max: number }) {
  const engine = engineFor(gameId);
  const [players, setPlayers] = useState(Math.min(Math.max(4, min), max));
  const [seed, setSeed] = useState(newSeed);
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

  // Pass-and-play: the screen follows whoever's turn it is. `tick` re-runs
  // this after every move.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is the trigger
  useEffect(() => {
    if (!session || !follow) return;
    const seat = session.active[0];
    if (seat !== undefined && seat !== session.viewing) session.setViewer(seat);
  }, [session, follow, tick]);

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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {Board && (
          <Board key={`${seed}-${players}`} session={session} players={seats} mode="sandbox" />
        )}
      </div>
      <aside className="space-y-4 text-sm">
        <section className="border border-rule p-4">
          <h2 className="label mb-3">Table</h2>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPlayers(n)}
                className={cn(
                  'label border px-2 py-1',
                  n === players ? 'border-paper text-paper' : 'border-rule',
                )}
              >
                {n}p
              </button>
            ))}
          </div>
          <p className="label mt-3 break-all normal-case">seed {seed.slice(0, 12)}…</p>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setSeed(newSeed())}>
            New game
          </Button>
        </section>
        <section className="border border-rule p-4">
          <h2 className="label mb-3">View as</h2>
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
                  'label border px-2 py-1',
                  session.viewing === s.seat ? 'border-paper text-paper' : 'border-rule',
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
              className={cn(
                'label border px-2 py-1',
                session.viewing === 'spectator' ? 'border-paper' : 'border-rule',
              )}
            >
              spectator
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            <span>Follow the turn (pass-and-play)</span>
          </label>
        </section>
        <section className="border border-rule p-4">
          <h2 className="label mb-3">Test bots</h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => session.botMove().catch((e: Error) => toast(e.message, 'bad'))}
            >
              Bot move
            </Button>
            <Button
              size="sm"
              variant={auto ? 'primary' : 'ghost'}
              onClick={() => setAuto((a) => !a)}
            >
              {auto ? 'Stop' : 'Autoplay'}
            </Button>
          </div>
        </section>
        <section className="border border-rule p-4">
          <div className="flex items-center justify-between">
            <h2 className="label">Log · v{tick}</h2>
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
            <ol className="mt-3 max-h-96 space-y-1 overflow-auto font-mono text-[11px] text-dim">
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
      </aside>
    </div>
  );
}
