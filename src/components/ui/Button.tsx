import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * The one button of the interface.
 *
 * `primary` is the accent fill and is meant for the single main action of a
 * screen; everything else is `secondary` (an outline). On phones every size is
 * at least 44 px high, the smallest target a thumb hits reliably.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent border-accent hover:bg-ink hover:border-ink',
  secondary: 'bg-transparent text-ink border-rule hover:bg-raised hover:border-ink',
  ghost: 'bg-transparent text-muted border-transparent hover:text-ink hover:bg-raised',
  danger: 'bg-transparent text-bad border-bad hover:bg-bad/10',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-2.5 text-xs gap-1.5',
  md: 'min-h-9 px-3.5 text-sm gap-2',
  lg: 'min-h-11 px-5 text-sm gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Forces the primary look regardless of variant, for a toggle or tab whose "on" state is the accent. */
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
      className={`inline-flex items-center justify-center font-label font-semibold uppercase tracking-label whitespace-nowrap border rounded-sm transition-colors bar:min-h-11 short:min-h-11 disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_CLASSES[resolvedVariant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
