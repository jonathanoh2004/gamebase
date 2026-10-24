import type { ReactNode } from 'react';
import { cn } from './cn';

/** A bordered surface with an optional mono header: "02 · Lobby". */
export function Panel({
  index,
  title,
  actions,
  className,
  bodyClassName,
  children,
}: {
  index?: string;
  title?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('border border-rule bg-ink-1', className)}>
      {(title || actions) && (
        <header className="flex min-h-10 items-center justify-between gap-3 border-rule border-b px-4">
          <span className="label">
            {index && <span className="text-dim">{index} · </span>}
            {title}
          </span>
          {actions}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'label inline-flex items-center gap-1 border border-rule px-2 py-0.5',
        className,
      )}
    >
      {children}
    </span>
  );
}
