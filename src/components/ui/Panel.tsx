import type { HTMLAttributes, ReactNode } from 'react';

type PanelPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING_CLASSES: Record<PanelPadding, string> = {
  none: '',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-5',
};

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  padding?: PanelPadding;
  bordered?: boolean;
  /** Nested/inset panel (e.g. a table container inside a view) — one shade lighter than the default surface. */
  inset?: boolean;
  children: ReactNode;
}

export function Panel({ padding = 'md', bordered = true, inset = false, className = '', children, ...rest }: PanelProps) {
  return (
    <div
      className={`${inset ? 'bg-aero-panel-2' : 'bg-aero-panel'} ${bordered ? 'border border-white/10' : ''} rounded-sm ${PADDING_CLASSES[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
