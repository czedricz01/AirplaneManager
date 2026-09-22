import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silently swallow and handle expected browser/Vite environment WebSocket warnings to prevent any crash screens
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason ? (reason.message || String(reason)) : '';
    if (
      msg.includes('WebSocket') || 
      msg.includes('websocket') || 
      msg.includes('ws://') || 
      msg.includes('wss://') || 
      msg.includes('vite')
    ) {
      console.warn('[Vite WS Bypass] Gracefully caught expected background websocket exception:', msg);
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('WebSocket') || 
      msg.includes('websocket') || 
      msg.includes('ws://') || 
      msg.includes('wss://') || 
      msg.includes('vite')
    ) {
      console.warn('[Vite WS Bypass] Gracefully caught expected background error:', msg);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

