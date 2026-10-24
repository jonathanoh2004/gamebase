'use client';

import { PLAYER_COLORS, type PlayerColor } from '@/lib/db/schema';
import { PALETTE } from '@/lib/palette';
import { cn } from './ui/cn';
import { ColorGlyph } from './ui/glyph';

export function ColorPicker({
  value,
  onChange,
  taken = [],
  disabled,
}: {
  value: PlayerColor;
  onChange: (c: PlayerColor) => void;
  taken?: PlayerColor[];
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
      {PLAYER_COLORS.map((c) => {
        const isTaken = taken.includes(c) && c !== value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a styled radio group of swatches
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === value}
            aria-label={`${PALETTE[c].label}${isTaken ? ' (taken)' : ''}`}
            disabled={disabled || isTaken}
            onClick={() => onChange(c)}
            className={cn(
              'flex size-10 items-center justify-center border transition-colors',
              c === value ? 'border-paper bg-ink-3' : 'border-rule hover:border-rule-strong',
              isTaken && 'opacity-25',
            )}
          >
            <ColorGlyph color={c} size={20} />
          </button>
        );
      })}
    </div>
  );
}
