'use client';

import { animate, stagger } from 'animejs';
import type { Move, StepCtx } from './director';
import { DUR, EASE, pieceSpring } from './tokens';

// Reusable choreography (docs/DESIGN.md §6.3). Every helper takes the frame's
// context so speed, skip and reduced motion apply automatically.

export interface Point {
  x: number;
  y: number;
}

/**
 * Hops a group of moves along a path of stage points, one arc per segment,
 * with squash-and-stretch on landing. `path` runs from the start position to
 * the end position (both included). `lag` delays each later mover a little,
 * so a stack wobbles like a tower.
 */
export async function hop<V>(
  ctx: StepCtx<V>,
  moves: Move[],
  path: Point[],
  opts: { height?: number; segment?: number; lag?: number } = {},
) {
  const end = path[path.length - 1];
  if (!end || path.length < 2 || moves.length === 0) return ctx.glide(moves);
  const height = opts.height ?? 42;
  const seg = opts.segment ?? DUR.hop;
  const lag = opts.lag ?? 28;
  // Offsets relative to the destination, in stage units.
  const pts = path.map((p) => ({ x: p.x - end.x, y: p.y - end.y }));
  const xs = pts.slice(1).map((p) => ({ to: p.x, duration: seg, ease: 'linear' }));
  const ys = pts.slice(1).flatMap((p, i) => {
    const prev = pts[i] ?? p;
    const mid = Math.min(prev.y, p.y) - height;
    return [
      { to: mid, duration: seg * 0.5, ease: 'out(2)' },
      { to: p.y, duration: seg * 0.5, ease: 'in(2)' },
    ];
  });
  await Promise.all(
    moves.map((m, i) => {
      const delay = i * lag;
      const travel = ctx.animate(m.motion, { x: xs, y: ys, delay });
      // Squash on each landing.
      const squash = ctx.animate(m.motion, {
        scaleY: pts.slice(1).flatMap(() => [
          { to: 1.06, duration: seg * 0.5, ease: 'out(2)' },
          { to: 0.88, duration: seg * 0.35, ease: 'in(2)' },
          { to: 1, duration: seg * 0.15, ease: 'out(2)' },
        ]),
        delay,
      });
      return Promise.all([travel, squash]);
    }),
  );
  await Promise.all(
    moves.map((m) =>
      ctx.animate(m.motion, { scaleY: [0.92, 1], duration: DUR.settle, ease: pieceSpring() }),
    ),
  );
}

/** A single arcing flight from wherever the offset says to home. */
export function arc<V>(
  ctx: StepCtx<V>,
  move: Move,
  opts: { lift?: number; duration?: number } = {},
) {
  const lift = opts.lift ?? 60;
  const duration = opts.duration ?? DUR.glide;
  const midY = Math.min(move.offset.y, 0) - lift;
  return Promise.all([
    ctx.animate(move.motion, { x: 0, rotate: 0, scale: 1, duration, ease: EASE.inOut }),
    ctx.animate(move.motion, {
      y: [
        { to: midY, duration: duration * 0.45, ease: 'out(2)' },
        { to: 0, duration: duration * 0.55, ease: 'in(2)' },
      ],
    }),
  ]);
}

export function pop<V>(ctx: StepCtx<V>, el: Element | null, scale = 1.18) {
  if (!el) return Promise.resolve();
  return ctx.animate(el, {
    scale: [
      { to: scale, duration: 120, ease: 'out(2)' },
      { to: 1, duration: 380, ease: pieceSpring() },
    ],
  });
}

export function shake<V>(ctx: StepCtx<V>, el: Element | null, amount = 6, duration = 520) {
  if (!el) return Promise.resolve();
  return ctx.animate(el, {
    rotate: [-amount, amount, -amount * 0.7, amount * 0.5, -amount * 0.3, 0].map((to) => ({
      to,
      duration: duration / 6,
    })),
    ease: 'inOut(2)',
  });
}

/** Ticks a number from `from` to `to` inside `el`. */
export function countUp<V>(
  ctx: StepCtx<V>,
  el: Element | null,
  from: number,
  to: number,
  duration = 700,
) {
  if (!el || from === to) return Promise.resolve();
  const box = { v: from };
  return ctx.animate(box, {
    v: to,
    duration,
    ease: 'out(3)',
    onUpdate: () => {
      el.textContent = String(Math.round(box.v));
    },
  });
}

/** A short-lived floating label ("+5", "−1") that rises and fades over `anchor`. */
export function floatText<V>(
  ctx: StepCtx<V>,
  anchor: Element | null,
  text: string,
  tone: 'good' | 'bad' | 'neutral' = 'neutral',
) {
  if (!anchor) return Promise.resolve();
  const tag = document.createElement('span');
  tag.textContent = text;
  tag.className = `float-tag float-tag-${tone}`;
  anchor.appendChild(tag);
  return ctx
    .animate(tag, {
      y: [6, -14],
      opacity: [
        { to: 1, duration: 120 },
        { to: 1, duration: 520 },
        { to: 0, duration: 260 },
      ],
      ease: 'out(2)',
      duration: 900,
    })
    .then(() => tag.remove());
}

/** Stagger-in for lists outside the director (lobby seats, library cards). */
export function staggerIn(targets: Element[] | NodeListOf<Element>, delay = 40) {
  return animate(targets, {
    opacity: [0, 1],
    y: [14, 0],
    duration: DUR.ui,
    ease: EASE.ui,
    delay: stagger(delay),
  });
}
