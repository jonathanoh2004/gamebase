'use client';

import { Dialog as Base } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { cn } from './cn';

/** Accessible modal (focus trap, Esc, scroll lock) in our visual language. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Base.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Base.Portal>
        <Base.Backdrop className="fixed inset-0 z-40 bg-ink-0/70 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Base.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 border border-rule-strong bg-ink-1 p-6',
            'transition-[opacity,transform] duration-200 ease-out data-[ending-style]:translate-y-[-46%] data-[starting-style]:translate-y-[-46%] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
            className,
          )}
        >
          <Base.Title className="font-bold text-xl tracking-tight">{title}</Base.Title>
          {description && (
            <Base.Description className="mt-2 text-dim text-sm">{description}</Base.Description>
          )}
          <div className="mt-5">{children}</div>
        </Base.Popup>
      </Base.Portal>
    </Base.Root>
  );
}
