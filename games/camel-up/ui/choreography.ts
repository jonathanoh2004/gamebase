'use client';

import { utils } from 'animejs';
import type { FramePlan, Move, StepCtx } from '@/lib/motion/director';
import { floatText, pop, shake } from '@/lib/motion/kit';
import { DUR, pieceSpring } from '@/lib/motion/tokens';
import { type CamelUpEvent, type CamelUpView, TRACK_LENGTH } from '../engine/types';
import { crossedPoint, groundPoint, PYRAMID_CENTER } from './geometry';
import { layoutCamelUp, STEP } from './layout';

// Event → animation (docs/DESIGN.md §6). Hero moments: the pyramid roll, the
// stack hop, spectator bounces, leg scoring and the final reveal.

export type Overlay =
  | { kind: 'banner'; title: string; sub?: string; tone?: 'gold' | 'plain' }
  | { kind: 'leg'; event: Extract<CamelUpEvent, { type: 'legScored' }> }
  | { kind: 'card'; event: Extract<CamelUpEvent, { type: 'overallCard' }> };

export interface ChoreoEnv {
  root: () => HTMLElement | null;
  setOverlay: (o: Overlay | null) => void;
  you: () => number | null;
}

type Ctx = StepCtx<CamelUpView>;
type Pt = { x: number; y: number };

const DOOR: Pt = { x: PYRAMID_CENTER.x, y: PYRAMID_CENTER.y + 46 };

/** Screen-space flight of a clone from one element's box to another's. */
async function flyGhost(
  ctx: Ctx,
  from: { rect: DOMRect; node: HTMLElement } | null,
  to: Element | null,
  duration = 620,
) {
  if (!from || !to) return;
  const target = to.getBoundingClientRect();
  if (target.width === 0) return;
  const ghost = from.node;
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.rect.left}px`,
    top: `${from.rect.top}px`,
    width: `${from.rect.width}px`,
    height: `${from.rect.height}px`,
    margin: '0',
    zIndex: '70',
    pointerEvents: 'none',
    transformOrigin: 'center',
  });
  document.body.appendChild(ghost);
  const dx = target.left + target.width / 2 - (from.rect.left + from.rect.width / 2);
  const dy = target.top + target.height / 2 - (from.rect.top + from.rect.height / 2);
  const scale = Math.max(
    0.2,
    Math.min(target.width / from.rect.width, target.height / from.rect.height),
  );
  try {
    await ctx.animate(ghost, {
      x: { to: dx, duration, ease: 'inOut(2)' },
      y: [
        { to: Math.min(dy, 0) - 70, duration: duration * 0.45, ease: 'out(2)' },
        { to: dy, duration: duration * 0.55, ease: 'in(2)' },
      ],
      scale: { to: scale, duration, ease: 'inOut(2)' },
      rotate: [
        { to: -6, duration: duration * 0.5 },
        { to: 0, duration: duration * 0.5 },
      ],
    });
  } finally {
    ghost.remove();
  }
}

function capture(el: Element | null): { rect: DOMRect; node: HTMLElement } | null {
  if (!el) return null;
  const node = el.cloneNode(true) as HTMLElement;
  node.removeAttribute('data-piece');
  return { rect: el.getBoundingClientRect(), node };
}

/** One piece hopping along stage points (start and end included). */
function hopAlong(
  ctx: Ctx,
  move: Move,
  points: Pt[],
  opts: { height: number; delay: number; seg: number },
) {
  const end = points[points.length - 1];
  if (!end || points.length < 2) return ctx.glide([move]);
  const rel = points.map((p) => ({ x: p.x - end.x, y: p.y - end.y }));
  const xs = rel.slice(1).map((p) => ({ to: p.x, duration: opts.seg, ease: 'linear' }));
  const ys = rel.slice(1).flatMap((p, i) => {
    const prev = rel[i] ?? p;
    return [
      { to: Math.min(prev.y, p.y) - opts.height, duration: opts.seg * 0.5, ease: 'out(2)' },
      { to: p.y, duration: opts.seg * 0.5, ease: 'in(2)' },
    ];
  });
  const squash = rel.slice(1).flatMap(() => [
    { to: 1.05, duration: opts.seg * 0.5, ease: 'out(2)' },
    { to: 0.9, duration: opts.seg * 0.32, ease: 'in(2)' },
    { to: 1, duration: opts.seg * 0.18, ease: 'out(2)' },
  ]);
  return Promise.all([
    ctx.animate(move.motion, { x: xs, y: ys, delay: opts.delay }),
    ctx.animate(move.motion, { scaleY: squash, delay: opts.delay }),
  ]);
}

/** The spaces a unit passes through, ending at its destination. */
function visited(from: number, to: number): number[] {
  const dir = Math.sign(to - from);
  const out: number[] = [];
  for (let s = from + dir; dir > 0 ? s <= to : s >= to; s += dir) out.push(s);
  return out;
}

function pointFor(space: number, k: number): Pt {
  const g = space >= 1 && space <= TRACK_LENGTH ? groundPoint(space) : crossedPoint(space);
  return { x: g.x, y: g.y - k * STEP };
}

export function makePlan(env: ChoreoEnv) {
  const q = (sel: string) => env.root()?.querySelector(sel) ?? null;

  return (
    event: CamelUpEvent | null,
    _prev: CamelUpView,
    next: CamelUpView,
  ): FramePlan<CamelUpView> => {
    if (!event) return {};
    switch (event.type) {
      case 'ticketTaken': {
        let source: ReturnType<typeof capture> = null;
        return {
          pre: () => {
            source = capture(q(`[data-tent="${event.color}"] [data-top-ticket]`));
          },
          travel: async (ctx, moves) => {
            const target = q(
              `[data-panel="${event.seat}"] [data-ticket-last]`,
            ) as HTMLElement | null;
            if (target) target.style.opacity = '0';
            await flyGhost(ctx, source, target);
            if (target) target.style.opacity = '';
            await Promise.all([pop(ctx, target, 1.3), ctx.glide(moves)]);
          },
        };
      }
      case 'pyramidTicketTaken': {
        let source: ReturnType<typeof capture> = null;
        return {
          pre: () => {
            source = capture(q('[data-pyramid-tickets] [data-top-token]'));
          },
          travel: async (ctx) => {
            await flyGhost(
              ctx,
              source,
              q(`[data-panel="${event.seat}"] [data-pyramid-count]`),
              520,
            );
            await pop(ctx, q(`[data-panel="${event.seat}"] [data-pyramid-count]`), 1.4);
          },
        };
      }
      case 'dieRolled':
        return {
          pre: async (ctx) => {
            const pyramid = q('[data-pyramid]');
            await Promise.all([
              shake(ctx, pyramid, 7, 560),
              ctx.animate(pyramid as Element, {
                y: [0, -10, 4, -6, 0],
                duration: 560,
                ease: 'inOut(2)',
              }),
            ]);
          },
          travel: async (ctx, moves) => {
            const id = `die-${event.die}`;
            const motion = ctx.motion(id);
            const slot = layoutCamelUp(next)[id];
            if (motion && slot) {
              const dx = DOOR.x - slot.x;
              const dy = DOOR.y - slot.y;
              utils.set(motion, { x: dx, y: dy, opacity: 1, scale: 0.45 });
              const cube = motion.querySelector('[data-cube]');
              const d = 820;
              await Promise.all([
                ctx.animate(motion, {
                  x: { to: 0, duration: d, ease: 'out(2)' },
                  y: [
                    { to: Math.min(dy, 0) - 110, duration: d * 0.42, ease: 'out(2)' },
                    { to: 0, duration: d * 0.58, ease: 'outBounce' },
                  ],
                  scale: { to: 1, duration: d * 0.5, ease: 'out(2)' },
                }),
                cube
                  ? ctx.animate(cube, {
                      rotateX: { from: -22 + 720 + 90 * (event.value % 3), to: -22 },
                      rotateY: { from: 28 - 540, to: 28 },
                      duration: d,
                      ease: 'out(3)',
                    })
                  : null,
              ]);
              await pop(ctx, motion, 1.15);
            }
            await ctx.glide(moves.filter((m) => m.id !== id));
          },
        };
      case 'camelsMoved':
        return {
          travel: async (ctx, moves) => {
            const unit = new Map(event.camels.map((c, k) => [`camel-${c}`, k]));
            const hopping = moves.filter((m) => unit.has(m.id));
            const sliding = moves.filter((m) => !unit.has(m.id));
            const spaces = visited(event.from, event.to);
            const bounce = event.cause !== 'die';
            for (const m of hopping) {
              const piece = ctx.piece(m.id);
              if (piece) piece.style.zIndex = '90';
            }
            await Promise.all([
              ...hopping.map((m) => {
                const k = unit.get(m.id) ?? 0;
                const pts = [m.from, ...spaces.slice(0, -1).map((s) => pointFor(s, k)), m.to];
                return hopAlong(ctx, m, pts, {
                  height: bounce ? 26 : 40 + k * 4,
                  seg: bounce ? 300 : DUR.hop,
                  delay: k * 34,
                });
              }),
              sliding.length
                ? ctx.glide(sliding, { duration: DUR.settle, ease: pieceSpring() })
                : null,
            ]);
            for (const m of hopping) {
              const piece = ctx.piece(m.id);
              if (piece) piece.style.zIndex = String(m.to.z ?? 0);
            }
          },
        };
      case 'spectatorPaid':
        return {
          post: async (ctx) => {
            const tile = q(`[data-piece="tile-${event.owner}"] [data-motion]`);
            await Promise.all([
              pop(ctx, tile, 1.22),
              floatText(ctx, q(`[data-panel="${event.owner}"] [data-coins]`), '+1', 'good'),
            ]);
          },
        };
      case 'spectatorPlaced':
        return {
          post: (ctx) => pop(ctx, q(`[data-piece="tile-${event.seat}"] [data-motion]`), 1.15),
        };
      case 'betPlaced': {
        return {
          post: async (ctx) => {
            const pile = q(`[data-pile="${event.pile}"] [data-pile-top]`);
            await pop(ctx, pile, 1.25);
          },
        };
      }
      case 'raceFinished':
        return {
          post: async (ctx) => {
            const leader = event.camels.filter((c) => c !== 'white' && c !== 'black').at(-1);
            env.setOverlay({
              kind: 'banner',
              title: event.direction === 'forward' ? 'Finish!' : 'Backwards over the line!',
              sub: leader ? `${leader} crosses the line` : 'The race is over',
              tone: 'gold',
            });
            await ctx.wait(1500);
            env.setOverlay(null);
          },
        };
      case 'legScored':
        return {
          post: async (ctx) => {
            env.setOverlay({ kind: 'leg', event });
            await ctx.wait(2600);
            env.setOverlay(null);
          },
        };
      case 'legReset':
        return {
          travel: async (ctx, moves) => {
            await ctx.glide(moves);
            env.setOverlay({
              kind: 'banner',
              title: `Leg ${event.leg}`,
              sub: 'Tickets and dice are back',
            });
            await ctx.wait(1000);
            env.setOverlay(null);
          },
        };
      case 'overallCard':
        return {
          post: async (ctx) => {
            env.setOverlay({ kind: 'card', event });
            await Promise.all([
              ctx.wait(1100),
              floatText(
                ctx,
                q(`[data-panel="${event.seat}"] [data-coins]`),
                event.payout > 0 ? `+${event.payout}` : String(event.payout),
                event.payout > 0 ? 'good' : 'bad',
              ),
            ]);
          },
        };
      case 'gameEnded':
        return {
          post: async (ctx) => {
            env.setOverlay({
              kind: 'banner',
              title: `${event.winner} wins`,
              sub: `${event.loser} came last`,
              tone: 'gold',
            });
            await ctx.wait(2200);
            env.setOverlay(null);
          },
        };
      case 'turnPassed':
        return {
          post: (ctx) => {
            if (event.seat === env.you()) return pop(ctx, q('[data-your-turn]'), 1.06);
            return undefined;
          },
        };
      default:
        return {};
    }
  };
}
