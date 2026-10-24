import { TRACK_LENGTH } from '../engine/types';
import {
  FINISH_X,
  INFIELD,
  LOSER_PILE,
  nextAngle,
  RING_X,
  RING_Y,
  STAGE_H,
  STAGE_W,
  TILE_H,
  TILE_W,
  tileRect,
  WINNER_PILE,
} from './geometry';

// The static board, drawn once: our own flat take on the printed layout
// (track ring, finish line, infield, piles). Nothing here moves.

const SAND_0 = 'var(--color-sand-0)';
const SAND_1 = 'var(--color-sand-1)';
const LINE = 'rgba(201,164,103,0.28)';

/** `highlight` marks legal spaces for the spectator tile; `strong` when the player is placing one. */
export function BoardArt({
  highlight,
  strong = false,
}: {
  highlight: Set<number>;
  strong?: boolean;
}) {
  const spaces = Array.from({ length: TRACK_LENGTH }, (_, i) => i + 1);
  return (
    <svg
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <rect width={STAGE_W} height={STAGE_H} fill={SAND_0} />
      {/* faint grid, the site's motif */}
      <g stroke="rgba(201,164,103,0.07)">
        {Array.from({ length: Math.floor(STAGE_W / 40) }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static grid
          <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={STAGE_H} />
        ))}
        {Array.from({ length: Math.floor(STAGE_H / 40) }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static grid
          <line key={`h${i}`} x1={0} y1={i * 40} x2={STAGE_W} y2={i * 40} />
        ))}
      </g>

      {/* track ring */}
      <rect
        x={RING_X - 6}
        y={RING_Y - 6}
        width={6 * TILE_W + 12}
        height={4 * TILE_H + 12}
        fill="none"
        stroke={LINE}
        strokeWidth="2"
      />
      {spaces.map((space) => {
        const r = tileRect(space);
        const lit = highlight.has(space);
        return (
          <g key={space}>
            <rect
              x={r.x + 3}
              y={r.y + 3}
              width={r.w - 6}
              height={r.h - 6}
              fill={lit ? (strong ? '#4d3c26' : '#43352a') : SAND_1}
              stroke={lit ? (strong ? 'var(--color-yellow)' : 'rgba(247,208,56,0.45)') : LINE}
              strokeWidth={lit && strong ? 4 : 1}
              strokeDasharray={lit && strong ? '10 8' : undefined}
            />
            {lit && (
              <circle
                cx={r.x + r.w - 18}
                cy={r.y + 20}
                r={strong ? 9 : 4.5}
                fill="var(--color-yellow)"
              />
            )}
            <text
              x={r.x + 14}
              y={r.y + 28}
              fill="rgba(242,239,232,0.55)"
              fontFamily="var(--font-mono)"
              fontSize="15"
              fontWeight="600"
            >
              {String(space).padStart(2, '0')}
            </text>
            <path
              d="M-3 -5 2 0 -3 5"
              transform={`translate(${r.x + 48} ${r.y + 23}) rotate(${nextAngle(space)})`}
              fill="none"
              stroke="rgba(242,239,232,0.32)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* finish line: a checkered strip between 16 and 1 */}
      <g>
        {Array.from({ length: 10 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static pattern
          <g key={i}>
            <rect
              x={FINISH_X - 7}
              y={RING_Y + i * 15}
              width="7"
              height="7.5"
              fill={i % 2 ? '#f2efe8' : '#0e0e10'}
            />
            <rect
              x={FINISH_X}
              y={RING_Y + i * 15}
              width="7"
              height="7.5"
              fill={i % 2 ? '#0e0e10' : '#f2efe8'}
            />
            <rect
              x={FINISH_X - 7}
              y={RING_Y + i * 15 + 7.5}
              width="7"
              height="7.5"
              fill={i % 2 ? '#0e0e10' : '#f2efe8'}
            />
            <rect
              x={FINISH_X}
              y={RING_Y + i * 15 + 7.5}
              width="7"
              height="7.5"
              fill={i % 2 ? '#f2efe8' : '#0e0e10'}
            />
          </g>
        ))}
        <text
          x={FINISH_X}
          y={RING_Y - 10}
          textAnchor="middle"
          fill="rgba(242,239,232,0.6)"
          fontFamily="var(--font-mono)"
          fontSize="11"
          letterSpacing="1.5"
        >
          FINISH
        </text>
      </g>

      {/* infield */}
      <rect
        x={INFIELD.x + 10}
        y={INFIELD.y + 10}
        width={INFIELD.w - 20}
        height={INFIELD.h - 20}
        fill="#251d14"
        stroke={LINE}
      />
      <text
        x={INFIELD.x + 430 - 30}
        y={INFIELD.y + 40}
        fill="rgba(242,239,232,0.45)"
        fontFamily="var(--font-mono)"
        fontSize="11"
        letterSpacing="1.5"
      >
        DICE TENTS
      </text>

      {/* overall bet piles */}
      {[
        { r: WINNER_PILE, label: 'OVERALL WINNER' },
        { r: LOSER_PILE, label: 'OVERALL LOSER' },
      ].map(({ r, label }) => (
        <g key={label}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#251d14" stroke={LINE} />
          <text
            x={r.x + 10}
            y={r.y + 18}
            fill="rgba(242,239,232,0.55)"
            fontFamily="var(--font-mono)"
            fontSize="10"
            letterSpacing="1.2"
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}
