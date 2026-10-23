import type { Seat } from '@/lib/engine/types';
import {
  type CamelId,
  type CamelUpState,
  type CrazyColor,
  isCrazy,
  isRacing,
  type RacingColor,
  type Side,
  TRACK_LENGTH,
} from './types';

// Track geometry, stacking and ranking (R15–R22). Pure helpers over state.

export interface Location {
  /** 1..16 */
  space: number;
  /** 0 = bottom of the stack. */
  height: number;
}

export function locate(track: CamelId[][], camel: CamelId): Location | null {
  for (let i = 0; i < track.length; i++) {
    const height = track[i]?.indexOf(camel) ?? -1;
    if (height >= 0) return { space: i + 1, height };
  }
  return null;
}

export const onTrack = (space: number) => space >= 1 && space <= TRACK_LENGTH;

export function spectatorAt(
  state: CamelUpState,
  space: number,
): { owner: Seat; side: Side } | null {
  for (let owner = 0; owner < state.players.length; owner++) {
    const tile = state.players[owner]?.spectator;
    if (tile && tile.space === space) return { owner, side: tile.side };
  }
  return null;
}

/**
 * R10: an empty space (no camels, no tile), not space 1, not next to another
 * player's tile, and not where your own tile already is. Your own tile doesn't
 * block its neighbors while you move it (ruling 1).
 */
export function canPlaceSpectator(state: CamelUpState, seat: Seat, space: number): boolean {
  if (!Number.isInteger(space) || space < 2 || space > TRACK_LENGTH) return false;
  if ((state.track[space - 1]?.length ?? 0) > 0) return false;
  for (let owner = 0; owner < state.players.length; owner++) {
    const tile = state.players[owner]?.spectator;
    if (!tile) continue;
    if (tile.space === space) return false;
    if (owner !== seat && Math.abs(tile.space - space) === 1) return false;
  }
  return true;
}

/** R17: which crazy camel the grey die moves. */
export function crazyToMove(track: CamelId[][], face: CrazyColor): CrazyColor {
  const carrying = (camel: CrazyColor) => {
    const at = locate(track, camel);
    if (!at) return false;
    return (track[at.space - 1] ?? []).slice(at.height + 1).some(isRacing);
  };
  const white = carrying('white');
  const black = carrying('black');
  if (white !== black) return white ? 'white' : 'black';
  const w = locate(track, 'white');
  const b = locate(track, 'black');
  if (w && b && w.space === b.space) {
    if (w.height === b.height + 1) return 'white';
    if (b.height === w.height + 1) return 'black';
  }
  return face;
}

/**
 * R21–R22: racing camels from first to last. Forward crossers lead, then the
 * track from space 16 down (top of a stack ahead of its bottom), then racing
 * camels carried backward over the line.
 */
export function ranking(state: CamelUpState): RacingColor[] {
  const order: CamelId[] = [];
  const crossed = state.crossed;
  if (crossed?.direction === 'forward') order.push(...[...crossed.camels].reverse());
  for (let i = state.track.length - 1; i >= 0; i--) {
    order.push(...[...(state.track[i] ?? [])].reverse());
  }
  if (crossed?.direction === 'backward') order.push(...[...crossed.camels].reverse());
  return order.filter(isRacing);
}

/** Every camel's position, including a unit that crossed the line. */
export function allPositions(state: CamelUpState): Map<CamelId, Location> {
  const out = new Map<CamelId, Location>();
  state.track.forEach((stack, i) => {
    stack.forEach((camel, height) => {
      out.set(camel, { space: i + 1, height });
    });
  });
  const crossed = state.crossed;
  if (crossed) {
    crossed.camels.forEach((camel, height) => {
      out.set(camel, { space: crossed.space, height });
    });
  }
  return out;
}

export const directionOf = (camel: CamelId) => (isCrazy(camel) ? -1 : 1);
