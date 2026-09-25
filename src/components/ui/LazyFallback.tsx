import { Loader2 } from 'lucide-react';

/**
 * Suspense fallback for a lazily-loaded view (see the `React.lazy` calls in
 * App.tsx). Most of the game's screens are reached from a tab click or an
 * already-open list, one at a time, so bundling every one of them into the
 * entry chunk only slowed down the first paint -- the start menu, then the
 * map -- for a screen a session might never open. Splitting them means each
 * one's code downloads on the click that opens it instead; on a warm cache
 * that is imperceptible, so this is normally on screen for a moment at most.
 * It shares ErrorBoundary's palette so a load and a fault read as the same
 * family of "something is happening here" state, not two different UIs.
 */
export function LazyFallback({ label }: { label?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-aero-black text-white/40 font-mono">
      <Loader2 size={28} className="animate-spin text-aero-yellow" />
      <div className="text-xs uppercase tracking-[0.3em]">
        {label ? `Loading ${label}` : 'Loading'}
      </div>
    </div>
  );
}
