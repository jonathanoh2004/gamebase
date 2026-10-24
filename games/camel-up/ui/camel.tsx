import { GLYPH_PATHS } from '@/lib/palette';
import type { CamelId } from '../engine/types';
import { CAMEL_STYLE } from './palette';

// Our own camel: flat geometric shapes, a saddle with the color's glyph, a
// flat back so camels stack. Racing camels face the race direction; crazy
// camels face the other way (R6, R19).

export const CAMEL_W = 72;
export const CAMEL_H = 52;
/** How far each camel in a stack sits above the one below it, in camel units. */
export const STACK_STEP = 22;

export function Camel({
  camel,
  facing = 'right',
  size = 1,
  title,
}: {
  camel: CamelId;
  facing?: 'left' | 'right';
  size?: number;
  title?: string;
}) {
  const s = CAMEL_STYLE[camel];
  const crazy = camel === 'white' || camel === 'black';
  return (
    <svg
      width={CAMEL_W * size}
      height={CAMEL_H * size}
      viewBox={`0 0 ${CAMEL_W} ${CAMEL_H}`}
      role="img"
      aria-label={title ?? `${s.label} camel`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <g transform={facing === 'left' ? `translate(${CAMEL_W} 0) scale(-1 1)` : undefined}>
        {/* contact shadow */}
        <ellipse cx="34" cy="49.5" rx="24" ry="2.4" fill="#000" opacity="0.32" />
        <g fill={s.fill}>
          {/* legs */}
          <path d="M15 33 14.5 47.5h4L20 34Z" />
          <path d="M22 34l.5 13.5h4L26 33Z" />
          <path d="M40 34v13.5h4L45 33Z" />
          <path d="M46.5 33l2 14.5h4L50.5 31Z" />
          {/* body and hump */}
          <path d="M10.5 30c-1-6 2.5-9.5 8-10 2.5-11.5 17-13 21-1.5 3.5.5 7 2 9.5 5l4 6c-1.5 4.5-6.5 6.5-13 6.5H17c-4 0-6-2-6.5-6Z" />
          {/* neck, head, ear */}
          <path d="M47.5 23c6-.5 7-5 8-11l5-.5c-.5 9.5-3 18-9.5 20Z" />
          <path d="M54.5 13c0-4.5 3.5-6.5 7.5-6l6.5 1.8c2.3.7 2 4.2-.3 4.4L60 14.6Z" />
          <path d="M57.8 7.2 58.6 4l2 3Z" />
        </g>
        <path
          d="M10.8 24.5C7 26 6.4 29.5 7.2 33"
          stroke={s.fill}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        {/* saddle with the color's glyph */}
        <rect
          x="19"
          y="22"
          width="20"
          height="10"
          rx="1.6"
          fill={s.ink}
          opacity={crazy ? 0.85 : 0.9}
        />
        {s.glyph === 'spiral' ? (
          <path
            d="M29 26.8a1.1 1.1 0 1 1 1.1 1.2 2.4 2.4 0 1 1-2.2-3 3.7 3.7 0 1 1-2.8 4.3"
            stroke={s.fill}
            strokeWidth="1.25"
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          <path d={GLYPH_PATHS[s.glyph]} transform="translate(24 22) scale(0.42)" fill={s.fill} />
        )}
        {/* eye */}
        <circle cx="63.8" cy="9.6" r="1.25" fill={s.ink} />
      </g>
    </svg>
  );
}
