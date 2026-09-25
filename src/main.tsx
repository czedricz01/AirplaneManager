import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalErrorCapture, logError } from './lib/debugLog';
import './index.css';

// Every uncaught error and rejected promise goes into the diagnostic log, in
// production too, so a crash report can say what happened before it.
installGlobalErrorCapture();

/**
 * After a new deploy, the old index bundle still references chunk files (e.g.
 * AirportDetailView-<hash>.js) that GitHub Pages no longer serves -- they were
 * replaced by chunks with a new hash. Opening a screen that is still lazy-loaded
 * then fails with "Failed to fetch dynamically imported module" and trips that
 * screen's error boundary, even though a normal reload would fetch the current
 * bundle and work fine.
 *
 * Vite's preload helper dispatches `vite:preloadError` on exactly this failure.
 * A sessionStorage flag makes the reload happen at most once per session, so a
 * genuinely broken chunk (not just staleness) doesn't reload forever.
 */
if (typeof window !== 'undefined') {
  const RELOAD_FLAG = 'chunk-reload-attempted';

  window.addEventListener('vite:preloadError', (event) => {
    logError('chunk-load', 'stale chunk detected, reloading', { message: event.payload?.message ?? String(event.payload) });
    if (sessionStorage.getItem(RELOAD_FLAG)) {
      // Already tried once this session -- reloading again would loop forever.
      return;
    }
    event.preventDefault();
    sessionStorage.setItem(RELOAD_FLAG, '1');
    window.location.reload();
  });

  // A successful load means the current bundle is fine; let a future stale
  // chunk trigger its own one-time reload instead of being silently skipped.
  window.setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);
}

/**
 * In development, Vite's HMR client reports a websocket error whenever the dev
 * server restarts. That is noise, not a fault in the app, so it is downgraded to a
 * warning instead of surfacing as an unhandled rejection.
 *
 * This deliberately does NOT swallow anything else: the previous version matched the
 * substring "vite" anywhere in a message and called stopPropagation() in the capture
 * phase, which hid real application errors and made them very hard to track down.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const isViteWebSocketNoise = (message: string) =>
    /websocket/i.test(message) && /\[vite\]|vite\/client|wss?:\/\//i.test(message);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason ? (reason.message || String(reason)) : '';
    if (isViteWebSocketNoise(msg)) {
      console.warn('[dev] Ignored Vite HMR websocket error:', msg);
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      The last line of defence. The individual screens have their own boundaries,
      so this one only catches a fault outside them -- but without it such a fault
      leaves a blank white page with nothing to click and no hint of what happened.
    */}
    <ErrorBoundary label="Airline Manager" resetLabel="RELOAD" onReset={() => window.location.reload()}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
