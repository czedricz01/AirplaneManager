import { useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Details that only appear on hover never appear on a touch screen: Tailwind's
 * `hover:` applies only where the device can hover. This keeps track of which
 * item was last tapped so its detail can be shown for a moment instead.
 *
 * Returns the tapped key (or null) and a pointer-up handler factory. Mouse
 * pointers are ignored, so desktop behaviour stays hover-only.
 */
export function useTapReveal<T>(ms = 2500): [T | null, (key: T) => (e: ReactPointerEvent) => void] {
  const [tapped, setTapped] = useState<T | null>(null);

  useEffect(() => {
    if (tapped === null) return;
    const timer = window.setTimeout(() => setTapped(null), ms);
    return () => window.clearTimeout(timer);
  }, [tapped, ms]);

  const onTap = (key: T) => (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') setTapped(key);
  };

  return [tapped, onTap];
}
