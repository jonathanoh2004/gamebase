import type { PlayerColor } from '@/lib/db/schema';
import { GLYPH_PATHS, type Glyph, PALETTE } from '@/lib/palette';

/** A player color as a colored glyph, so color is never the only cue. */
export function ColorGlyph({
  color,
  size = 16,
  className,
  title,
}: {
  color: PlayerColor;
  size?: number;
  className?: string;
  title?: string;
}) {
  const p = PALETTE[color];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={title ?? p.label}
    >
      <path d={GLYPH_PATHS[p.glyph]} fill={p.css} />
    </svg>
  );
}

export function GlyphShape({
  glyph,
  fill,
  size = 16,
}: {
  glyph: Glyph;
  fill: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={GLYPH_PATHS[glyph]} fill={fill} />
    </svg>
  );
}
