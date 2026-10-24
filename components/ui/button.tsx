import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'ghost' | 'quiet' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-paper text-ink-0 hover:bg-yellow active:bg-yellow disabled:bg-ink-3 disabled:text-mute',
  ghost:
    'border border-rule-strong text-paper hover:border-paper active:bg-ink-2 disabled:border-rule disabled:text-mute',
  quiet: 'text-dim hover:text-paper hover:bg-ink-2 disabled:text-mute',
  danger:
    'border border-red/60 text-red hover:bg-red hover:text-ink-0 disabled:border-rule disabled:text-mute',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[11px]',
  md: 'h-10 px-4 text-[12px]',
  lg: 'h-12 px-6 text-[13px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-xs font-mono font-medium uppercase tracking-[0.08em]',
        'transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
