import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-aero-yellow text-black border-aero-yellow hover:bg-white hover:border-white',
  secondary: 'bg-aero-panel text-white border-white/10 hover:border-aero-yellow hover:text-aero-yellow',
  ghost: 'bg-transparent text-white/60 border-transparent hover:text-white hover:bg-white/5',
  danger: 'bg-transparent text-aero-warn border-aero-warn/50 hover:bg-aero-warn/10',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-3xs gap-1',
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
      className={`inline-flex items-center justify-center font-mono font-bold uppercase tracking-widest border rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow ${VARIANT_CLASSES[resolvedVariant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
