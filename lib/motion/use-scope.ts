'use client';

import { createScope, type Scope } from 'animejs';
import { type DependencyList, type RefObject, useEffect } from 'react';

/**
 * Runs anime.js setup code inside a scope bound to `root`; everything it
 * creates is reverted when the component unmounts or `deps` change, so no
 * animation ever outlives its element.
 */
export function useAnimeScope(
  root: RefObject<HTMLElement | SVGElement | null>,
  /** May return a cleanup function. */
  setup: (scope: Scope) => unknown,
  deps: DependencyList,
) {
  useEffect(() => {
    if (!root.current) return;
    const scope = createScope({ root: root.current as HTMLElement }).add(
      (s) => setup(s as Scope) as undefined,
    );
    return () => scope.revert();
  }, deps);
}
