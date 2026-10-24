import type { PlayerColor } from '@/lib/db/schema';
import { PALETTE } from '@/lib/palette';

// Generated geometric avatars: a 3×3 grid of shapes drawn from the seed, in
// the player's color. No photos are ever pulled from Google or Discord.

function hash(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

const SHAPES = ['none', 'circle', 'square', 'tri', 'quarter', 'dot'] as const;

export function Avatar({
  seed,
  color,
  size = 32,
  className,
  label,
}: {
  seed: string;
  color: PlayerColor;
  size?: number;
  className?: string;
  label?: string;
}) {
  const rand = hash(seed);
  const fill = PALETTE[color].css;
  const cells = Array.from({ length: 9 }, (_, i) => {
    const shape = SHAPES[Math.floor(rand() * SHAPES.length)] ?? 'none';
    const rot = Math.floor(rand() * 4) * 90;
    const tone = rand() > 0.72 ? 'var(--color-paper)' : fill;
    return { i, shape: i === 4 && shape === 'none' ? 'circle' : shape, rot, tone };
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      className={className}
      role="img"
      aria-label={label ?? 'avatar'}
    >
      <rect width="30" height="30" fill="var(--color-ink-3)" />
      {cells.map(({ i, shape, rot, tone }) => {
        const x = (i % 3) * 10;
        const y = Math.floor(i / 3) * 10;
        const t = `rotate(${rot} ${x + 5} ${y + 5})`;
        switch (shape) {
          case 'circle':
            return <circle key={i} cx={x + 5} cy={y + 5} r={4} fill={tone} />;
          case 'square':
            return <rect key={i} x={x + 1.5} y={y + 1.5} width={7} height={7} fill={tone} />;
          case 'tri':
            return (
              <path
                key={i}
                d={`M${x + 1} ${y + 9}L${x + 5} ${y + 1}L${x + 9} ${y + 9}Z`}
                fill={tone}
                transform={t}
              />
            );
          case 'quarter':
            return (
              <path
                key={i}
                d={`M${x + 1} ${y + 9}V${y + 1}A8 8 0 0 1 ${x + 9} ${y + 9}Z`}
                fill={tone}
                transform={t}
              />
            );
          case 'dot':
            return <circle key={i} cx={x + 5} cy={y + 5} r={1.6} fill={tone} />;
          default:
            return null;
        }
      })}
    </svg>
  );
}
