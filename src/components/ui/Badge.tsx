import type { ReactNode } from 'react';

export type BadgeTone = 'yellow' | 'good' | 'warn' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  yellow: 'text-aero-yellow bg-aero-yellow/5 border-aero-yellow/30',
  good: 'text-aero-good bg-aero-good/5 border-aero-good/30',
  warn: 'text-aero-warn bg-aero-warn/5 border-aero-warn/30',
  neutral: 'text-white/60 bg-white/5 border-white/20',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-3xs font-mono font-bold uppercase tracking-widest border rounded-sm whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
