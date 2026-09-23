import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

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
