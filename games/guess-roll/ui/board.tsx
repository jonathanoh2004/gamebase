'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import type { BoardProps } from '@/games/client';
import { ApiError } from '@/lib/client/api';
import { useFramePlayer } from '@/lib/client/use-frame-player';
import { pop } from '@/lib/motion/kit';
import { Stage } from '@/lib/motion/stage';
import type { GuessRollEvent, GuessRollView } from '../engine';

// DEV-ONLY test game board: deliberately plain. It exercises the runtime:
// snapshots, frames, redaction, simultaneous turns.

export function GuessRollBoard({ session, players }: BoardProps) {
  const { view, seat, stageRef } = useFramePlayer<GuessRollView, GuessRollEvent>(session, {
    layout: () => ({}),
    plan: (event) =>
      event?.type === 'rolled'
        ? { post: (ctx) => pop(ctx, ctx.stage.querySelector('[data-die]'), 1.4) }
        : {},
  });
  const [busy, setBusy] = useState(false);
  if (!view) return <p className="label">Loading…</p>;

  const pick = async (guess: 'low' | 'high') => {
    setBusy(true);
    try {
      await session.act({ type: 'pick', guess });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : (err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const canPick = seat !== null && view.myPick === null && !view.winners;
  return (
    <div className="space-y-4" data-testid="guess-roll">
      <Stage ref={stageRef} width={900} height={260} className="border border-rule bg-ink-1">
        <div className="flex h-full items-center gap-10 px-10">
          <div
            data-die
            className="flex size-28 items-center justify-center bg-teal font-extrabold text-6xl text-ink-0"
            data-testid="last-roll"
          >
            {view.lastRoll ?? '?'}
          </div>
          <div className="space-y-2">
            <p className="label">
              Round {view.round} · first to {view.target}
            </p>
            {players.map((p) => (
              <div key={p.seat} className="flex items-center gap-3">
                <Avatar seed={p.avatarSeed} color={p.color} size={24} />
                <span className="w-28 truncate">{p.name}</span>
                <span className="font-mono" data-testid={`score-${p.seat}`}>
                  {view.scores[p.seat]}
                </span>
                <span className="label">{view.called[p.seat] ? 'called' : '…'}</span>
              </div>
            ))}
          </div>
        </div>
      </Stage>
      {view.winners ? (
        <p className="label text-green">Game over</p>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => pick('low')} disabled={!canPick || busy} data-testid="pick-low">
            Low 1–3
          </Button>
          <Button onClick={() => pick('high')} disabled={!canPick || busy} data-testid="pick-high">
            High 4–6
          </Button>
          {view.myPick && <span className="label self-center">you called {view.myPick}</span>}
        </div>
      )}
    </div>
  );
}
