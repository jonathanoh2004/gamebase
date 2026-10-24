import type { Glyph } from '@/lib/palette';
import type { CamelId, DieId } from '../engine/types';

// Camel Up's colors in our palette, each with a glyph for color-blind play.

export const CAMEL_STYLE: Record<
  CamelId,
  { fill: string; ink: string; glyph: Glyph | 'spiral'; label: string }
> = {
  blue: { fill: 'var(--color-blue)', ink: 'var(--color-ink-0)', glyph: 'cross', label: 'Blue' },
  green: {
    fill: 'var(--color-green)',
    ink: 'var(--color-ink-0)',
    glyph: 'diamond',
    label: 'Green',
  },
  red: { fill: 'var(--color-red)', ink: 'var(--color-ink-0)', glyph: 'circle', label: 'Red' },
  yellow: {
    fill: 'var(--color-yellow)',
    ink: 'var(--color-ink-0)',
    glyph: 'square',
    label: 'Yellow',
  },
  purple: {
    fill: 'var(--color-violet)',
    ink: 'var(--color-ink-0)',
    glyph: 'star',
    label: 'Purple',
  },
  white: {
    fill: 'var(--color-bone)',
    ink: 'var(--color-ink-0)',
    glyph: 'spiral',
    label: 'White (crazy)',
  },
  black: {
    fill: 'var(--color-coal)',
    ink: 'var(--color-bone)',
    glyph: 'spiral',
    label: 'Black (crazy)',
  },
};

export const DIE_STYLE: Record<DieId, { fill: string; pip: string; label: string }> = {
  blue: { fill: 'var(--color-blue)', pip: 'var(--color-ink-0)', label: 'Blue die' },
  green: { fill: 'var(--color-green)', pip: 'var(--color-ink-0)', label: 'Green die' },
  red: { fill: 'var(--color-red)', pip: 'var(--color-ink-0)', label: 'Red die' },
  yellow: { fill: 'var(--color-yellow)', pip: 'var(--color-ink-0)', label: 'Yellow die' },
  purple: { fill: 'var(--color-violet)', pip: 'var(--color-ink-0)', label: 'Purple die' },
  grey: { fill: '#8b8a8f', pip: 'var(--color-ink-0)', label: 'Grey die' },
};

export const camelName = (c: CamelId) => CAMEL_STYLE[c].label.replace(' (crazy)', '');
