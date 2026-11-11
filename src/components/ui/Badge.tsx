import type { ReactNode } from 'react';

export type BadgeTone = 'yellow' | 'good' | 'warn' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  yellow: 'text-accent bg-accent/5 border-accent/30',
  good: 'text-good bg-good/5 border-good/30',
  warn: 'text-bad bg-bad/5 border-bad/30',
  neutral: 'text-muted bg-surface border-rule',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  /** Shown on hover, for a badge that is only a short label. */
  title?: string;
}

export function Badge({ tone = 'neutral', children, className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-1 text-2xs font-label font-semibold uppercase tracking-label border rounded-sm whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
