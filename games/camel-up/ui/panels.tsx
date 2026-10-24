'use client';

import { animate } from 'animejs';
import { useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/components/ui/cn';
import { useReducedMotion } from '@/lib/motion/reduced';
import type { MatchPlayer } from '@/lib/server/rooms';
import type { CamelUpView, RacingColor } from '../engine/types';
import { CAMEL_STYLE } from './palette';
import { Coin, PyramidToken, Ticket } from './pieces';

/** Coins tick up and down instead of jumping. */
function Coins({ value }: { value: number | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (value === null || from === null || from === value || reduced) {
      el.textContent = value === null ? '?' : String(value);
      return;
    }
    const box = { v: from };
    const a = animate(box, {
      v: value,
      duration: 720,
      ease: 'out(3)',
      onUpdate: () => {
        el.textContent = String(Math.round(box.v));
      },
    });
    return () => {
      a.complete();
    };
  }, [value, reduced]);
  return (
    <span ref={ref} className="tabular-nums">
      {value === null ? '?' : value}
    </span>
  );
}

export function PlayerPanel({
  view,
  seat,
  player,
  canPartner,
  onPartner,
  onPickBet,
}: {
  view: CamelUpView;
  seat: number;
  player: MatchPlayer | undefined;
  canPartner: boolean;
  onPartner: () => void;
  onPickBet?: (color: RacingColor) => void;
}) {
  const p = view.players[seat];
  if (!p) return null;
  const isTurn = view.phase === 'playing' && view.turn === seat;
  const isYou = view.you === seat;
  const partner = p.partner !== null ? view.players[p.partner] : null;
  return (
    <div
      data-panel={seat}
      data-testid={`panel-${seat}`}
      className={cn(
        'relative border bg-ink-1 p-3 transition-[border-color,background-color] duration-300',
        isTurn ? 'border-yellow' : 'border-rule',
        isYou && 'bg-ink-2',
      )}
    >
      {isTurn && (
        <span className="absolute top-0 left-0 h-full w-[3px] bg-yellow" aria-hidden="true" />
      )}
      <div className="flex items-center gap-2">
        {player && <Avatar seed={player.avatarSeed} color={player.color} size={26} />}
        <span className="min-w-0 flex-1 truncate font-bold">
          {p.name}
          {isYou && <span className="label ml-1.5">you</span>}
        </span>
        <span className="relative flex items-center gap-1 font-mono font-semibold" data-coins>
          <Coin size={16} />
          <Coins value={p.coins} />
        </span>
      </div>

      <div className="mt-2 flex min-h-7 flex-wrap items-center gap-1">
        {p.legTickets.map((t, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: tickets are only ever appended within a leg
            key={`${t.color}-${i}`}
            data-ticket-last={i === p.legTickets.length - 1 ? '' : undefined}
          >
            <Ticket color={t.color} value={t.value} size="sm" />
          </span>
        ))}
        {p.legTickets.length === 0 && <span className="label">no tickets</span>}
        <span className="ml-auto flex items-center gap-1" data-pyramid-count>
          <PyramidToken className="h-5 w-auto" />
          <span className="font-mono text-dim text-xs">×{p.pyramidTickets}</span>
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="label">
          {p.spectator
            ? `tile on ${p.spectator.space} ${p.spectator.side === 'cheer' ? '+1' : '−1'}`
            : 'tile in hand'}
        </span>
        {isYou && p.hand ? (
          <span className="flex gap-1">
            {p.hand.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!onPickBet}
                onClick={() => onPickBet?.(c)}
                className="size-4 rounded-[3px] disabled:cursor-default"
                style={{ background: CAMEL_STYLE[c].fill }}
                aria-label={`${CAMEL_STYLE[c].label} finish card`}
              />
            ))}
          </span>
        ) : (
          <span className="label">{p.handCount} cards</span>
        )}
      </div>

      {(partner || canPartner) && (
        <div className="mt-2 flex items-center justify-between">
          {partner ? <span className="label text-teal">partner · {partner.name}</span> : <span />}
          {canPartner && (
            <button
              type="button"
              onClick={onPartner}
              className="label border border-teal/60 px-2 py-0.5 text-teal hover:bg-teal hover:text-ink-0"
            >
              Partner up
            </button>
          )}
        </div>
      )}
    </div>
  );
}
