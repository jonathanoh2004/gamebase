'use client';

import { animate, createTimeline, stagger } from 'animejs';
import { useRef } from 'react';
import { useReducedMotion } from '@/lib/motion/reduced';
import { useAnimeScope } from '@/lib/motion/use-scope';
import { cn } from './ui/cn';

const PIECES = [
  { color: 'var(--color-red)', shape: 'circle' },
  { color: 'var(--color-yellow)', shape: 'square' },
  { color: 'var(--color-blue)', shape: 'tri' },
  { color: 'var(--color-green)', shape: 'die' },
  { color: 'var(--color-violet)', shape: 'square' },
] as const;

/**
 * "gamebase": letters spring up in sequence while five game pieces drop onto
 * the baseline, then idle with a slow bob. Static under reduced motion.
 */
export function Wordmark({
  size = 'lg',
  animated = true,
}: {
  size?: 'sm' | 'lg';
  animated?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const play = animated && !reduced;

  useAnimeScope(root, () => {
    if (!play || !root.current) return;
    const letters = root.current.querySelectorAll('[data-letter]');
    const pieces = root.current.querySelectorAll('[data-piece-mark]');
    createTimeline()
      .add(letters, {
        y: { from: '0.9em', to: 0 },
        opacity: [0, 1],
        duration: 720,
        ease: 'out(4)',
        delay: stagger(38),
      })
      .add(
        pieces,
        {
          y: { from: -46, to: 0, ease: 'outBounce' },
          opacity: [0, 1],
          rotate: { from: -90, to: 0 },
          duration: 760,
          delay: stagger(70),
        },
        '-=520',
      );
    // The idle bob runs on the inner shape so it never fights the drop-in.
    animate(root.current.querySelectorAll('[data-piece-mark] > svg'), {
      y: [0, -4, 0],
      duration: 2600,
      ease: 'inOut(2)',
      loop: true,
      delay: stagger(220, { start: 1700 }),
    });
  }, [play]);

  const big = size === 'lg';
  return (
    <div
      ref={root}
      role="img"
      aria-label="gamebase"
      className={cn('inline-flex flex-col', big ? 'gap-3' : 'gap-1')}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex overflow-hidden pb-[0.14em] font-extrabold leading-[0.95] tracking-[-0.045em]',
          big ? 'text-[clamp(3.5rem,11vw,9rem)]' : 'text-xl',
        )}
      >
        {'gamebase'.split('').map((ch, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static string
          <span key={i} data-letter className="inline-block will-change-transform">
            {ch}
          </span>
        ))}
      </span>
      {big && (
        <span aria-hidden="true" className="flex items-end gap-3 pl-1">
          {PIECES.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            <span key={i} data-piece-mark className="inline-block will-change-transform">
              <PieceMark shape={p.shape} color={p.color} />
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function PieceMark({ shape, color }: { shape: string; color: string }) {
  const s = 22;
  return (
    <svg width={s} height={s} viewBox="0 0 22 22" aria-hidden="true">
      {shape === 'circle' && <circle cx="11" cy="11" r="10" fill={color} />}
      {shape === 'square' && <rect x="1" y="1" width="20" height="20" fill={color} />}
      {shape === 'tri' && <path d="M11 1 21 21H1Z" fill={color} />}
      {shape === 'die' && (
        <g>
          <rect x="1" y="1" width="20" height="20" rx="3" fill={color} />
          <circle cx="6.5" cy="6.5" r="2" fill="var(--color-ink-0)" />
          <circle cx="11" cy="11" r="2" fill="var(--color-ink-0)" />
          <circle cx="15.5" cy="15.5" r="2" fill="var(--color-ink-0)" />
        </g>
      )}
    </svg>
  );
}
