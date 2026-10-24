import type { Layout } from '@/lib/motion/director';
import type { CamelId, CamelUpView } from '../engine/types';
import { STACK_STEP } from './camel';
import { crossedPoint, diceSlot, groundPoint, tileRect } from './geometry';

// The single source of truth for where every moving piece rests (DESIGN.md
// §6.1). React renders pieces here; the director animates between layouts.

export const CAMEL_SCALE = 1.1;
export const STEP = STACK_STEP * CAMEL_SCALE;

export function camelPlacement(space: number, height: number, onTrack = true) {
  const g = onTrack ? groundPoint(space) : crossedPoint(space);
  return { x: g.x, y: g.y - height * STEP, z: 20 + height };
}

export function layoutCamelUp(view: CamelUpView): Layout {
  const out: Layout = {};
  view.track.forEach((stack, i) => {
    stack.forEach((camel, height) => {
      out[`camel-${camel}`] = camelPlacement(i + 1, height);
    });
  });
  if (view.crossed) {
    const { space, camels } = view.crossed;
    camels.forEach((camel, height) => {
      out[`camel-${camel}`] = { ...camelPlacement(space, height, false), z: 60 + height };
    });
  }
  view.rolled.forEach((d, i) => {
    out[`die-${d.die}`] = { ...diceSlot(i), z: 10 };
  });
  view.players.forEach((p, seat) => {
    if (!p.spectator) return;
    const r = tileRect(p.spectator.space);
    out[`tile-${seat}`] = { x: r.x + r.w / 2, y: r.y + r.h / 2 + 18, z: 4 };
  });
  return out;
}

/** Where each camel is, for the board's renderer. */
export function camelSpaces(
  view: CamelUpView,
): Map<CamelId, { space: number; height: number; crossed: boolean }> {
  const out = new Map<CamelId, { space: number; height: number; crossed: boolean }>();
  view.track.forEach((stack, i) => {
    stack.forEach((camel, height) => {
      out.set(camel, { space: i + 1, height, crossed: false });
    });
  });
  view.crossed?.camels.forEach((camel, height) => {
    out.set(camel, { space: view.crossed?.space ?? 0, height, crossed: true });
  });
  return out;
}
