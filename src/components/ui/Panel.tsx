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
  /** A panel inside a panel: one tone lighter than the surface it sits on. */
  inset?: boolean;
  children: ReactNode;
}

/** A bounded area of a screen. Square corners, a fine line, no shadow. */
export function Panel({ padding = 'md', bordered = true, inset = false, className = '', children, ...rest }: PanelProps) {
  return (
    <div
      className={`${inset ? 'bg-raised' : 'bg-surface'} ${bordered ? 'border border-line' : ''} ${PADDING_CLASSES[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
