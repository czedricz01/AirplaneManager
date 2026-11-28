import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface DetailsProps {
  /** The line that stays visible; a click on it opens or closes the rest. */
  summary: ReactNode;
  /** Open at first. Closed unless set. */
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A fold for detail the player rarely needs at a glance, such as how a figure is worked out:
 * the summary line stays, the rest opens on a click. Built on the browser's own <details>,
 * so it works with the keyboard and screen readers without extra code.
 */
export function Details({ summary, defaultOpen = false, className = '', children }: DetailsProps) {
  return (
    <details className={`group/details ${className}`} open={defaultOpen || undefined}>
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center gap-1 text-2xs font-semibold uppercase tracking-label text-muted hover:text-ink transition-colors">
        <ChevronDown size={12} aria-hidden="true" className="shrink-0 -rotate-90 transition-transform group-open/details:rotate-0" />
        <span className="min-w-0 flex-1">{summary}</span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
