import { spring } from 'animejs';

// Motion tokens (docs/DESIGN.md §2.3). Chrome is quick; pieces have weight.

export const DUR = {
  snap: 140,
  ui: 340,
  glide: 520,
  hop: 230,
  settle: 420,
  reveal: 620,
  fade: 160,
} as const;

export const EASE = {
  ui: 'out(3)',
  inOut: 'inOut(2)',
  back: 'outBack(1.7)',
  soft: 'out(2)',
  in: 'in(2)',
} as const;

/** A weighty, slightly bouncy spring for pieces landing. */
export const pieceSpring = () => spring({ mass: 1, stiffness: 190, damping: 17 });
/** A snappier spring for UI morphs. */
export const uiSpring = () => spring({ mass: 1, stiffness: 320, damping: 26 });
