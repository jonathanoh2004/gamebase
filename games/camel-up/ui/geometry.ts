import type { RacingColor } from '../engine/types';
import { RACING, TRACK_LENGTH } from '../engine/types';

// Board geometry in stage units (1200 × 800). The track is a ring of 16
// square-ish tiles, 6 across and 4 down, numbered clockwise from the finish
// line at the top center, as on the printed board.

export const STAGE_W = 1200;
export const STAGE_H = 800;

export const TILE_W = 168;
export const TILE_H = 150;
export const RING_X = (STAGE_W - 6 * TILE_W) / 2; // 96
export const RING_Y = 190;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Grid cell (column, row) of each space, 1..16. */
const CELLS: Record<number, [number, number]> = {
  1: [3, 0],
  2: [4, 0],
  3: [5, 0],
  4: [5, 1],
  5: [5, 2],
  6: [5, 3],
  7: [4, 3],
  8: [3, 3],
  9: [2, 3],
  10: [1, 3],
  11: [0, 3],
  12: [0, 2],
  13: [0, 1],
  14: [0, 0],
  15: [1, 0],
  16: [2, 0],
};

export function tileRect(space: number): Rect {
  const cell = CELLS[space];
  if (!cell) throw new RangeError(`no space ${space}`);
  return { x: RING_X + cell[0] * TILE_W, y: RING_Y + cell[1] * TILE_H, w: TILE_W, h: TILE_H };
}

/** Where a stack's bottom camel stands (its center), on a track space. */
export function groundPoint(space: number): { x: number; y: number } {
  const r = tileRect(space);
  return { x: r.x + r.w / 2, y: r.y + r.h - 46 };
}

/** The finish line sits on the boundary between space 16 and space 1. */
export const FINISH_X = RING_X + 3 * TILE_W;
export const FINISH_TOP = RING_Y;

/** Off-board landing spots for a unit that crossed the line. */
export function crossedPoint(space: number): { x: number; y: number } {
  return space > TRACK_LENGTH
    ? { x: FINISH_X + 44 + (space - TRACK_LENGTH - 1) * 18, y: RING_Y - 24 }
    : { x: FINISH_X - 44 - (1 - space) * 18, y: RING_Y - 24 };
}

/** Racing camels face the race direction on screen: right along the top, left along the bottom. */
export function raceFacing(space: number): 'left' | 'right' {
  const cell = CELLS[Math.min(Math.max(space, 1), TRACK_LENGTH)];
  if (!cell) return 'right';
  const [, row] = cell;
  if (row === 3) return 'left';
  if (row === 0) return 'right';
  return cell[0] === 5 ? 'right' : 'left';
}

// Infield ---------------------------------------------------------------------

export const INFIELD: Rect = {
  x: RING_X + TILE_W,
  y: RING_Y + TILE_H,
  w: 4 * TILE_W,
  h: 2 * TILE_H,
};

export const PYRAMID_CENTER = { x: INFIELD.x + 150, y: INFIELD.y + INFIELD.h / 2 + 8 };
export const PYRAMID_TICKETS_AT = { x: INFIELD.x + 312, y: INFIELD.y + INFIELD.h - 64 };

/** Dice tents: where the n-th rolled die of the leg rests. */
export function diceSlot(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: INFIELD.x + 430 + col * 78, y: INFIELD.y + 96 + row * 92 };
}

// Top band ----------------------------------------------------------------------

export const TENT_W = 92;
export const TENT_H = 118;
const TENT_GAP = 16;
const TENTS_W = RACING.length * TENT_W + (RACING.length - 1) * TENT_GAP;

export function tentRect(color: RacingColor): Rect {
  const i = RACING.indexOf(color);
  return {
    x: (STAGE_W - TENTS_W) / 2 + i * (TENT_W + TENT_GAP),
    y: 22,
    w: TENT_W,
    h: TENT_H,
  };
}

export const WINNER_PILE: Rect = { x: RING_X, y: 22, w: 150, h: 118 };
export const LOSER_PILE: Rect = { x: STAGE_W - RING_X - 150, y: 22, w: 150, h: 118 };
