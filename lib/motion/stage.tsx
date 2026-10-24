'use client';

import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { Placement } from './director';

// A fixed design-space canvas (e.g. 1200×760) scaled to fit its container.
// Games lay pieces out once, in design units, for every screen size.

export interface StageProps {
  width: number;
  height: number;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement | null>;
  label?: string;
}

export function Stage({ width, height, className, children, ref, label }: StageProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useImperativeHandle(ref, () => inner.current as HTMLDivElement, []);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setScale(Math.max(0.1, Math.min(w / width, h > 0 ? h / height : Number.POSITIVE_INFINITY)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div
      ref={outer}
      className={className}
      style={{ position: 'relative', width: '100%', aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label={label}
    >
      <div
        ref={inner}
        data-stage
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          width,
          height,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {children}
        <div data-ghost-layer style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

export interface PieceProps {
  id: string;
  place: Placement;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * A board piece centered on its placement. React owns the outer transform
 * (where it rests); the director owns the inner [data-motion] wrapper (how it
 * gets there). They never write to the same element.
 */
export function Piece({ id, place, className, style, children }: PieceProps) {
  const rotate = place.rotate ? ` rotate(${place.rotate}deg)` : '';
  const scale = place.scale && place.scale !== 1 ? ` scale(${place.scale})` : '';
  return (
    <div
      data-piece={id}
      className={className}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${place.x}px, ${place.y}px)${rotate}${scale}`,
        zIndex: place.z ?? 0,
        ...style,
      }}
    >
      <div data-motion style={{ willChange: 'transform' }}>
        <div style={{ transform: 'translate(-50%, -50%)' }}>{children}</div>
      </div>
    </div>
  );
}
