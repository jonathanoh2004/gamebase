import { cn } from '@/components/ui/cn';
import type { PlayerColor } from '@/lib/db/schema';
import { GLYPH_PATHS, PALETTE } from '@/lib/palette';
import type { CrazyColor, DieId, RacingColor, Side } from '../engine/types';
import { CAMEL_STYLE, DIE_STYLE } from './palette';

// Small board pieces: dice (real CSS 3D cubes), spectator tiles, tickets,
// finish cards and pyramid tokens. All original art.

const OTHER: Record<number, [number, number]> = { 1: [2, 3], 2: [3, 1], 3: [1, 2] };

/**
 * A die as a CSS 3D cube. The front face shows the result; the rest are the
 * die's other faces (1–3 twice each). The cube itself ([data-cube]) is what
 * the roll animation tumbles.
 */
export function Die({
  die,
  value,
  face,
  size = 46,
}: {
  die: DieId;
  value: number;
  face: CrazyColor | null;
  size?: number;
}) {
  const s = DIE_STYLE[die];
  const half = size / 2;
  const [a, b] = OTHER[value] ?? [1, 2];
  const ink = die === 'grey' ? (face === 'white' ? '#f2efe8' : '#111114') : s.pip;
  const faces: { t: string; v: number; shade: number }[] = [
    { t: `translateZ(${half}px)`, v: value, shade: 0 },
    { t: `rotateY(180deg) translateZ(${half}px)`, v: value, shade: 0.35 },
    { t: `rotateY(90deg) translateZ(${half}px)`, v: a, shade: 0.22 },
    { t: `rotateY(-90deg) translateZ(${half}px)`, v: b, shade: 0.22 },
    { t: `rotateX(90deg) translateZ(${half}px)`, v: b, shade: 0.08 },
    { t: `rotateX(-90deg) translateZ(${half}px)`, v: a, shade: 0.4 },
  ];
  return (
    <div
      style={{ width: size, height: size, perspective: 420 }}
      aria-label={`${s.label}: ${value}`}
      role="img"
    >
      <div
        data-cube
        style={{
          position: 'relative',
          width: size,
          height: size,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(-22deg) rotateY(28deg)',
        }}
      >
        {faces.map((f) => (
          <div
            key={f.t}
            style={{
              position: 'absolute',
              inset: 0,
              transform: f.t,
              background: s.fill,
              boxShadow: `inset 0 0 0 999px rgba(0,0,0,${f.shade})`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: ink,
              fontWeight: 800,
              fontSize: size * 0.56,
              lineHeight: 1,
              backfaceVisibility: 'hidden',
            }}
          >
            {f.v}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpectatorTile({
  side,
  owner,
  className,
}: {
  side: Side;
  owner: PlayerColor;
  className?: string;
}) {
  const cheer = side === 'cheer';
  return (
    <div
      className={cn(
        'flex h-[62px] w-[104px] items-center justify-between gap-1 rounded-[6px] border-2 px-3',
        cheer ? 'bg-[#1f4a35]' : 'bg-[#5a2420]',
        className,
      )}
      style={{ borderColor: PALETTE[owner].css }}
      role="img"
      aria-label={`${cheer ? 'Cheering' : 'Booing'} spectator tile`}
    >
      <span className={cn('font-extrabold text-3xl', cheer ? 'text-green' : 'text-red')}>
        {cheer ? '+1' : '−1'}
      </span>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path d={GLYPH_PATHS[PALETTE[owner].glyph]} fill={PALETTE[owner].css} />
      </svg>
    </div>
  );
}

/** A leg betting ticket: color, face value, and the 2nd/other payouts. */
export function Ticket({
  color,
  value,
  size = 'lg',
}: {
  color: RacingColor;
  value: number;
  size?: 'lg' | 'sm';
}) {
  const s = CAMEL_STYLE[color];
  if (size === 'sm') {
    return (
      <span
        className="inline-flex h-7 w-6 items-center justify-center rounded-[3px] font-extrabold text-ink-0 text-sm"
        style={{ background: s.fill }}
        role="img"
        aria-label={`${s.label} ticket worth ${value}`}
      >
        {value}
      </span>
    );
  }
  return (
    <div
      className="flex h-[96px] w-[76px] flex-col justify-between rounded-[5px] p-2 text-ink-0"
      style={{ background: s.fill }}
      role="img"
      aria-label={`${s.label} ticket worth ${value}`}
    >
      <span className="font-extrabold text-4xl leading-none">{value}</span>
      <span className="flex justify-between font-mono font-semibold text-[10px]">
        <span>2nd +1</span>
        <span>−1</span>
      </span>
    </div>
  );
}

/** The back of a finish card (overall bets), marked with its owner's glyph. */
export function CardBack({ owner, color }: { owner: PlayerColor; color?: RacingColor | null }) {
  return (
    <div
      className="flex h-[54px] w-[40px] items-center justify-center rounded-[4px] border border-sand-2/60 bg-sand-1"
      role="img"
      aria-label={color ? `${CAMEL_STYLE[color].label} card` : 'face-down card'}
    >
      {color ? (
        <span className="size-5 rounded-full" style={{ background: CAMEL_STYLE[color].fill }} />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d={GLYPH_PATHS[PALETTE[owner].glyph]} fill={PALETTE[owner].css} />
        </svg>
      )}
    </div>
  );
}

export function PyramidToken({ className }: { className?: string }) {
  return (
    <svg width="44" height="40" viewBox="0 0 44 40" className={className} aria-hidden="true">
      <path
        d="M11 2h22l10 18-10 18H11L1 20Z"
        fill="var(--color-sand-2)"
        stroke="#7b5f35"
        strokeWidth="2"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="16" fontWeight="800" fill="#2a2117">
        1
      </text>
    </svg>
  );
}

export function Coin({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--color-yellow)" stroke="#b8901a" strokeWidth="2" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#4a3a0a">
        1
      </text>
    </svg>
  );
}
