import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** What is missing, in a few words: "No routes yet". */
  title: string;
  /** What to do about it, in one sentence. */
  children?: ReactNode;
  /** A button that does it. */
  action?: ReactNode;
  className?: string;
}

/** The empty state: a list or a screen with nothing to show, and the way to change that. */
export function EmptyState({ title, children, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-12 px-4 text-center ${className}`}>
      <div className="font-label font-semibold text-lg text-ink">{title}</div>
      {children && <div className="text-sm text-muted max-w-[48ch]">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
