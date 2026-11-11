import type { ReactNode } from 'react';

export type BadgeTone = 'yellow' | 'good' | 'warn' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  yellow: 'text-accent border-accent',
  good: 'text-good border-good',
  warn: 'text-bad border-bad',
  neutral: 'text-muted border-rule',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  /** Shown on hover, for a badge that is only a short label. */
  title?: string;
}

/** A short status word in an outline. The word carries the meaning; the colour repeats it. */
export function Badge({ tone = 'neutral', children, className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-2xs font-label font-semibold uppercase tracking-label border rounded-sm whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
