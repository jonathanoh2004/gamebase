'use client';

import { animate, stagger } from 'animejs';
import { useRef } from 'react';
import { useReducedMotion } from '@/lib/motion/reduced';
import { useAnimeScope } from '@/lib/motion/use-scope';
import type { CamelUpView } from '../engine/types';
import { Camel } from './camel';
import type { Overlay } from './choreography';
import { CAMEL_STYLE, camelName } from './palette';

/** Center-stage moments: banners, the leg payout, overall-bet reveals. */
export function BoardOverlay({ overlay, view }: { overlay: Overlay | null; view: CamelUpView }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useAnimeScope(root, () => {
    if (!overlay || reduced || !root.current) return;
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
  }, [overlay, reduced]);

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
        className="pointer-events-auto border border-rule-strong bg-ink-0/95 px-10 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      >
        {overlay.kind === 'banner' && (
          <div className="text-center">
            <p
              className={`font-extrabold text-6xl capitalize tracking-[-0.04em] ${overlay.tone === 'gold' ? 'text-yellow' : 'text-paper'}`}
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
                    <span
                      className={
                        s.total > 0 ? 'text-green' : s.total < 0 ? 'text-red' : 'text-mute'
                      }
                    >
                      {s.total > 0 ? `+${s.total}` : s.total}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {overlay.kind === 'card' && (
          <div className="flex items-center gap-6">
            <div
              className="flex h-[120px] w-[88px] items-center justify-center rounded-[6px]"
              style={{ background: CAMEL_STYLE[overlay.event.color].fill }}
            >
              <Camel camel={overlay.event.color} size={0.9} />
            </div>
            <div>
              <p className="label">
                Overall {overlay.event.pile} · card {overlay.event.index + 1}
              </p>
              <p className="mt-2 font-extrabold text-3xl">{name(overlay.event.seat)}</p>
              <p className="mt-1 text-dim">
                bet on {camelName(overlay.event.color).toLowerCase()} ·{' '}
                <span className={overlay.event.correct ? 'text-green' : 'text-red'}>
                  {overlay.event.payout > 0 ? `+${overlay.event.payout}` : overlay.event.payout}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
