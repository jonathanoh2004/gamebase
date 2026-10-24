'use client';

import { cn } from '@/components/ui/cn';
import type { OptionsProps } from '@/games/client';

export function CamelUpOptions({ options, editable, onChange }: OptionsProps) {
  const hideMoney = options.hideMoney === true;
  return (
    <label className={cn('flex items-start gap-3', editable ? 'cursor-pointer' : 'opacity-70')}>
      <input
        type="checkbox"
        className="mt-1 size-4 accent-[var(--color-yellow)]"
        checked={hideMoney}
        disabled={!editable}
        onChange={(e) => onChange({ ...options, hideMoney: e.target.checked })}
      />
      <span>
        <span className="block text-sm">Hide money totals</span>
        <span className="block text-mute text-xs">
          You only see your own coins until the end, as the rulebook allows.
        </span>
      </span>
    </label>
  );
}
