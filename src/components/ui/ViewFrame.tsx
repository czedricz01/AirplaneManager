import type { ReactNode } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

/**
 * Shared shell for every in-game tab. Replaces 6 identical copies of an
 * absolutely-positioned overlay that painted a remote Unsplash photo behind a
 * 95%-opacity black + blur layer — the photo never showed through, it just
 * cost a network fetch on every tab switch.
 *
 * It also contains faults: a render error in one tab used to reach the root
 * boundary, whose only way out is a page reload that loses the unsaved month.
 */
interface ViewFrameProps {
  children: ReactNode;
  /** Extra classes for the inner content wrapper, e.g. centering a placeholder message. */
  contentClassName?: string;
  /** Names the tab in the error panel and the diagnostic log. */
  label?: string;
  /** Where the error panel's button leads, usually back to the map. */
  onReset?: () => void;
}

export function ViewFrame({ children, contentClassName = 'w-full h-full', label = 'View', onReset }: ViewFrameProps) {
  return (
    <div className="absolute inset-0 z-40 bg-aero-black flex">
      <div className={`relative z-10 ${contentClassName}`}>
        <ErrorBoundary label={label} onReset={onReset} resetLabel="BACK TO MAP">
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
}
