import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Note: anything put in `define` is inlined verbatim into the client bundle and is
  // therefore public. Secrets belong on the server; browser-safe values must use the
  // VITE_ prefix and are read via import.meta.env.
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // The airport dataset dominates the bundle; splitting it out keeps the app
      // shell small and lets the browser cache the data separately.
      rollupOptions: {
        output: {
          manualChunks: {
            'airport-data': ['./src/data/airports.ts', './src/data/more_airports.ts'],
            'aircraft-data': ['./src/data/aircraft.ts', './src/data/fuelPrices.ts'],
            'map-vendor': ['leaflet', 'react-leaflet'],
          },
        },
      },
      chunkSizeWarningLimit: 900,
    },
    server: {
      // HMR can be disabled via the DISABLE_HMR env var when file watching causes
      // flickering (e.g. while an agent is editing files).
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
