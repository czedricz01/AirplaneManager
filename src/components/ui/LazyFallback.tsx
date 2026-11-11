import { Loader2 } from 'lucide-react';

/**
 * The loading state: what a screen shows while its code or data arrives.
 *
 * Most of the game's screens are loaded on the click that opens them (see the
 * `React.lazy` calls in App.tsx), so this is normally on screen for a moment
 * at most. It uses the same layout as EmptyState and the error panel, so
 * loading, nothing-here and something-broke read as one family.
 */
export function LazyFallback({ label }: { label?: string }) {
  return (
    <div role="status" className="w-full h-full flex flex-col items-center justify-center gap-3 bg-ground text-muted">
      <Loader2 size={24} className="animate-spin text-accent" aria-hidden="true" />
      <div className="text-sm">{label ? `Loading ${label}…` : 'Loading…'}</div>
    </div>
  );
}
