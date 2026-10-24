'use client';

import { animate, stagger } from 'animejs';
import { useRef } from 'react';
import { useReducedMotion } from '@/lib/motion/reduced';
import { useAnimeScope } from '@/lib/motion/use-scope';
import { RACING } from '../engine/types';
import { Camel } from './camel';

/** Library cover: five camels bounding across the dunes, in a wave. */
export function CamelUpCover({ active }: { active: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Hop in a wave while the herd drifts forward and back. Created inside the
  // scope, so everything is reverted on unmount.
  useAnimeScope(root, () => {
    if (reduced || !root.current) return;
    const speed = active ? 1.8 : 1;
    animate(root.current.querySelectorAll('[data-cover-camel]'), {
      y: [0, -16, 0],
      scaleY: [1, 1.06, 0.9, 1],
      duration: 520,
      ease: 'inOut(2)',
      loop: true,
      loopDelay: 380,
      playbackRate: speed,
      delay: stagger(110),
    });
    const herd = root.current.querySelector('[data-cover-herd]');
    if (herd) {
      animate(herd, {
        x: [-12, 18],
        duration: 3200,
        ease: 'inOut(2)',
        alternate: true,
        loop: true,
        playbackRate: speed,
      });
    }
  }, [active, reduced]);

  return (
    <div ref={root} className="relative h-full w-full overflow-hidden bg-sand-0">
      {/* sun */}
      <div className="absolute top-[14%] right-[16%] size-14 rounded-full bg-yellow" />
      {/* pyramid: two flat faces */}
      <svg
        className="absolute bottom-[26%] left-[8%] w-[46%]"
        viewBox="0 0 200 110"
        aria-hidden="true"
      >
        <path d="M100 4 196 106H4Z" fill="var(--color-sand-2)" />
        <path d="M100 4 196 106H118Z" fill="#a8844e" />
      </svg>
      {/* dunes */}
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-sand-1" />
      <div className="absolute inset-x-0 bottom-[30%] h-px bg-sand-2/50" />
      <div data-cover-herd className="absolute bottom-[19%] left-[6%] flex gap-1">
        {RACING.map((c) => (
          <div key={c} data-cover-camel style={{ transformOrigin: 'bottom center' }}>
            <Camel camel={c} size={0.9} />
          </div>
        ))}
      </div>
    </div>
  );
}
