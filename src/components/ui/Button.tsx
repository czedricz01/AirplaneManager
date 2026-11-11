import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent border-accent hover:bg-ink hover:border-ink',
  secondary: 'bg-surface text-ink border-line hover:border-accent hover:text-accent',
  ghost: 'bg-transparent text-muted border-transparent hover:text-ink hover:bg-raised',
  danger: 'bg-transparent text-bad border-bad/50 hover:bg-bad/10',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-2xs gap-1',
  md: 'px-3 py-2 text-2xs gap-1.5',
  lg: 'px-4 py-4 text-sm gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Forces the primary look regardless of variant — for toggle/tab buttons whose "on" state is the accent. */
  active?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  active = false,
  icon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const resolvedVariant = active ? 'primary' : variant;
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-label font-semibold uppercase tracking-label border rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${VARIANT_CLASSES[resolvedVariant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
