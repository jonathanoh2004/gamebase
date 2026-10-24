'use client';

import { animate, stagger } from 'animejs';
import { useRef } from 'react';
import { cn } from '@/components/ui/cn';
import { useReducedMotion } from '@/lib/motion/reduced';
import { useAnimeScope } from '@/lib/motion/use-scope';
import type { CamelUpView } from '../engine/types';
import { Camel } from './camel';
import type { Overlay } from './choreography';
import { CAMEL_STYLE, camelName } from './palette';

type PileCard = Extract<Overlay, { kind: 'pile' }>['cards'][number];

/** A stable identity per overlay, so appending a pile row doesn't replay the entrance. */
function keyOf(o: Overlay): string {
  switch (o.kind) {
    case 'banner':
      return `banner:${o.title}`;
    case 'leg':
      return `leg:${o.event.leg}`;
    case 'pile':
      return `pile:${o.pile}`;
    case 'final':
      return 'final';
  }
}

/** Center-stage moments: banners, the leg payout, overall-bet reveals, the finale. */
export function BoardOverlay({
  overlay,
  view,
  onClose,
}: {
  overlay: Overlay | null;
  view: CamelUpView;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const key = overlay ? keyOf(overlay) : null;

  useAnimeScope(root, () => {
    if (!key || reduced || !root.current) return;
    const card = root.current.querySelector('[data-overlay-card]');
    if (card) {
      animate(card, { opacity: [0, 1], scale: [0.88, 1], duration: 380, ease: 'outBack(1.6)' });
    }
    const rows = root.current.querySelectorAll('[data-overlay-row]');
    if (rows.length) {
      animate(rows, {
        opacity: [0, 1],
        x: [-18, 0],
        duration: 420,
        ease: 'out(3)',
        delay: stagger(70, { start: 120 }),
      });
    }
  }, [key, reduced]);

  if (!overlay) return null;
  const name = (seat: number) => view.players[seat]?.name ?? `Seat ${seat + 1}`;

  return (
    <div
      ref={root}
      className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center"
      aria-live="polite"
    >
      <div
        data-overlay-card
        className="pointer-events-auto relative border border-rule-strong bg-ink-1 px-10 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      >
        {overlay.kind === 'banner' && (
          <div className="text-center">
            <p
              className={cn(
                'font-extrabold text-6xl tracking-[-0.04em]',
                overlay.tone === 'gold' ? 'text-yellow' : 'text-paper',
              )}
            >
              {overlay.title}
            </p>
            {overlay.sub && <p className="label mt-3 text-sm">{overlay.sub}</p>}
          </div>
        )}

        {overlay.kind === 'leg' && (
          <div className="min-w-[440px]">
            <p className="label">Leg {overlay.event.leg} · payout</p>
            <div className="mt-4 flex items-end gap-4">
              {overlay.event.ranking.slice(0, 2).map((c, i) => (
                <div key={c} className="flex flex-col items-center gap-1">
                  <Camel camel={c} size={i === 0 ? 1.1 : 0.85} />
                  <span className="label">{i === 0 ? '1st' : '2nd'}</span>
                </div>
              ))}
            </div>
            <ul className="mt-5 space-y-1.5">
              {overlay.event.scores.map((s) => (
                <li
                  key={s.seat}
                  data-overlay-row
                  className="flex items-center justify-between gap-6"
                >
                  <span className="font-bold">{name(s.seat)}</span>
                  <span className="flex items-center gap-2 font-mono">
                    <span className="text-mute text-xs">
                      {s.lines.length === 0
                        ? 'no bets'
                        : s.lines.map((l) => (l.reward > 0 ? `+${l.reward}` : l.reward)).join(' ')}
                    </span>
                    <Delta value={s.total} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {overlay.kind === 'pile' && (
          <div className="min-w-[420px]">
            <div className="flex items-center gap-3">
              {overlay.camel && <Camel camel={overlay.camel} size={0.8} />}
              <div>
                <p className="label">Overall {overlay.pile}</p>
                <p className="font-bold">
                  {overlay.camel
                    ? `${camelName(overlay.camel)} ${overlay.pile === 'winner' ? 'won the race' : 'came last'}`
                    : 'The bets are revealed'}
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-1.5">
              {overlay.cards.map((c) => (
                <PileRow key={c.index} card={c} name={name(c.seat)} />
              ))}
            </ul>
          </div>
        )}

        {overlay.kind === 'final' && (
          <FinalStandings overlay={overlay} view={view} name={name} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  return (
    <span className={value > 0 ? 'text-green' : value < 0 ? 'text-red' : 'text-mute'}>
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

/** One revealed finish card; each animates in as it arrives. */
function PileRow({ card, name }: { card: PileCard; name: string }) {
  const ref = useRef<HTMLLIElement>(null);
  const reduced = useReducedMotion();
  useAnimeScope(ref, () => {
    if (reduced || !ref.current) return;
    animate(ref.current, { opacity: [0, 1], x: [-18, 0], duration: 360, ease: 'out(3)' });
  }, [reduced]);
  return (
    <li ref={ref} className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-2">
        <span className="label w-5 text-right">{card.index + 1}</span>
        <span
          className="size-3 rounded-full"
          style={{ background: CAMEL_STYLE[card.color].fill }}
          aria-hidden="true"
        />
        <span className="font-bold">{name}</span>
        <span className="text-mute text-sm">{camelName(card.color).toLowerCase()}</span>
      </span>
      <span className="font-mono">
        <Delta value={card.payout} />
      </span>
    </li>
  );
}

function FinalStandings({
  overlay,
  view,
  name,
  onClose,
}: {
  overlay: Extract<Overlay, { kind: 'final' }>;
  view: CamelUpView;
  name: (seat: number) => string;
  onClose: () => void;
}) {
  const coins = view.players.map((p, seat) => ({ seat, coins: p.coins ?? 0 }));
  const distinct = [...new Set(coins.map((c) => c.coins))].sort((a, b) => b - a);
  const ranked = coins
    .map((c) => ({ ...c, rank: distinct.indexOf(c.coins) + 1 }))
    .sort((a, b) => a.rank - b.rank || a.seat - b.seat);
  const winners = ranked.filter((r) => r.rank === 1);
  // Tied players share the victory (rulebook, end of game).
  const title = winners.length === 1 ? `${name(winners[0]?.seat ?? 0)} wins` : 'Shared victory';
  return (
    <div className="min-w-[420px]">
      <button
        type="button"
        onClick={onClose}
        className="label absolute top-3 right-3 hover:text-paper"
        aria-label="Close the standings"
      >
        close ✕
      </button>
      <p className="label">Final standings</p>
      <p className="mt-2 max-w-[560px] break-words font-extrabold text-5xl text-yellow tracking-[-0.04em]">
        {title}
      </p>
      <p className="mt-2 text-dim text-sm">
        {camelName(overlay.winner)} won the race · {camelName(overlay.loser).toLowerCase()} came
        last
      </p>
      <ol className="mt-5 space-y-1.5">
        {ranked.map((r) => (
          <li key={r.seat} data-overlay-row className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-3">
              <span
                className={cn('w-5 font-extrabold', r.rank === 1 ? 'text-yellow' : 'text-mute')}
              >
                {r.rank}
              </span>
              <span className="font-bold">
                {name(r.seat)}
                {view.you === r.seat && <span className="label ml-1.5">you</span>}
              </span>
            </span>
            <span className="font-mono">{r.coins}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
