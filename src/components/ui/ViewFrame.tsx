import type { ReactNode } from 'react';

/**
 * Shared shell for every in-game tab. Replaces 6 identical copies of an
 * absolutely-positioned overlay that painted a remote Unsplash photo behind a
 * 95%-opacity black + blur layer — the photo never showed through, it just
 * cost a network fetch on every tab switch.
 */
interface ViewFrameProps {
  children: ReactNode;
  /** Extra classes for the inner content wrapper, e.g. centering a placeholder message. */
  contentClassName?: string;
}

export function ViewFrame({ children, contentClassName = 'w-full h-full' }: ViewFrameProps) {
  return (
    <div className="absolute inset-0 z-40 bg-aero-black flex">
      <div className={`relative z-10 ${contentClassName}`}>{children}</div>
    </div>
  );
}
