import type { PlayerColor } from '@/lib/db/schema';

// The piece palette (docs/DESIGN.md §2.3). Every color is paired with a glyph
// so nothing ever depends on color alone.

export type Glyph =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'diamond'
  | 'pentagon'
  | 'cross'
  | 'star'
  | 'hexagon';

export const PALETTE: Record<PlayerColor, { css: string; glyph: Glyph; label: string }> = {
  red: { css: 'var(--color-red)', glyph: 'circle', label: 'Red' },
  orange: { css: 'var(--color-orange)', glyph: 'triangle', label: 'Orange' },
  yellow: { css: 'var(--color-yellow)', glyph: 'square', label: 'Yellow' },
  green: { css: 'var(--color-green)', glyph: 'diamond', label: 'Green' },
  teal: { css: 'var(--color-teal)', glyph: 'pentagon', label: 'Teal' },
  blue: { css: 'var(--color-blue)', glyph: 'cross', label: 'Blue' },
  violet: { css: 'var(--color-violet)', glyph: 'star', label: 'Violet' },
  pink: { css: 'var(--color-pink)', glyph: 'hexagon', label: 'Pink' },
};

/** SVG path for a glyph centered in a 24×24 box. */
export const GLYPH_PATHS: Record<Glyph, string> = {
  circle: 'M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14Z',
  triangle: 'M12 4.5 20 18.5H4Z',
  square: 'M5.5 5.5h13v13h-13Z',
  diamond: 'M12 3.5 20.5 12 12 20.5 3.5 12Z',
  pentagon: 'M12 4 20 9.8 17 19H7L4 9.8Z',
  cross: 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5Z',
  star: 'M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4 6.9 19.2 8 13.5l-4.3-4 5.8-.7Z',
  hexagon: 'M12 3.5 19.4 7.75v8.5L12 20.5 4.6 16.25v-8.5Z',
};
