'use client';

import { animate } from 'animejs';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { prefersReducedMotion } from '@/lib/motion/reduced';
import { DUR, EASE } from '@/lib/motion/tokens';
import { cn } from './cn';

type Tone = 'info' | 'good' | 'bad';
interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

const useToasts = create<{
  items: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  drop: (id: number) => void;
}>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 4200);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = (text: string, tone: Tone = 'info') =>
  useToasts.getState().push({ text, tone });

function Item({ t }: { t: Toast }) {
  const ref = useRef<HTMLButtonElement>(null);
  const drop = useToasts((s) => s.drop);
  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const a = animate(ref.current, {
      opacity: [0, 1],
      x: [24, 0],
      duration: DUR.ui,
      ease: EASE.ui,
    });
    return () => {
      a.revert();
    };
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => drop(t.id)}
      className={cn(
        'pointer-events-auto flex w-full items-center gap-3 border bg-ink-1 px-4 py-3 text-left text-sm',
        t.tone === 'bad'
          ? 'border-red/70'
          : t.tone === 'good'
            ? 'border-green/70'
            : 'border-rule-strong',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 shrink-0',
          t.tone === 'bad' ? 'bg-red' : t.tone === 'good' ? 'bg-green' : 'bg-yellow',
        )}
      />
      {t.text}
    </button>
  );
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2"
    >
      {items.map((t) => (
        <Item key={t.id} t={t} />
      ))}
    </div>
  );
}
