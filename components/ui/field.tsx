import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
      {error ? (
        <span className="mt-2 block text-red text-xs" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-2 block text-mute text-xs">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-xs border border-rule-strong bg-ink-0 px-3 text-paper placeholder:text-mute',
        'transition-colors focus:border-paper focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}
