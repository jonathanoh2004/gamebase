'use client';

import { useEffect, useRef, useState } from 'react';
import type { Frame } from '@/lib/engine/types';
import { Director, type FramePlan, type Layout } from '@/lib/motion/director';
import { useReducedMotion } from '@/lib/motion/reduced';
import type { GameSession } from './session';

/**
 * Connects a board to a session: renders the latest snapshot, then animates
 * each incoming frame through the director. Returns the view to render.
 */
export function useFramePlayer<V, E>(
  session: GameSession,
  opts: {
    layout: (view: V) => Layout;
    plan?: (event: E | null, prev: V, next: V) => FramePlan<V>;
    /** Called after each frame has played (logs, sounds). */
    onFrame?: (frame: Frame<V, E>) => void;
  },
) {
  const [view, setView] = useState<V | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const directorRef = useRef<Director<V, E> | null>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let director: Director<V, E> | null = null;
    const detach = session.attachBoard((msg) => {
      if (msg.kind === 'snapshot') {
        setSeat(msg.seat);
        if (!director) {
          director = new Director<V, E>(msg.view as V, {
            stage: () => stageRef.current,
            layout: (v) => optsRef.current.layout(v),
            plan: (e, prev, next) => optsRef.current.plan?.(e, prev, next) ?? {},
            commit: setView,
            reduced: () => reducedRef.current,
            onBusyChange: setBusy,
            onFrame: (f) => optsRef.current.onFrame?.(f),
          });
          directorRef.current = director;
          setView(msg.view as V);
        } else {
          director.snap(msg.view as V, msg.version);
        }
      } else {
        director?.enqueue(msg.frames as never);
      }
    });
    return () => {
      detach();
      director?.dispose();
      directorRef.current = null;
    };
  }, [session]);

  return {
    view,
    seat,
    busy,
    stageRef,
    skip: () => directorRef.current?.skip(),
    setSpeed: (s: number) => directorRef.current?.setSpeed(s),
  };
}
