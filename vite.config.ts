import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// `npm run build:static` sets this. It produces a single self-contained HTML file
// that runs from any web host and from a local file:// path, with no Node.js and no
// server — see scripts/inline-static.mjs and the README.
const isStaticBuild = process.env.STATIC_BUILD === '1';

export default defineConfig(() => {
  // Note: anything put in `define` is inlined verbatim into the client bundle and is
  // therefore public. Secrets belong on the server; browser-safe values must use the
  // VITE_ prefix and are read via import.meta.env.
  return {
    // Relative asset URLs, so the build also works when it is not served from a
    // domain root (a subfolder, an artifact host, or a local file).
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: isStaticBuild
      ? {
          outDir: 'dist-static',
          // One classic script and one stylesheet, which scripts/inline-static.mjs
          // then folds into the HTML. A plain IIFE (not an ES module) is what makes
          // the result openable straight from disk.
          cssCodeSplit: false,
          modulePreload: false,
          rollupOptions: {
            output: {
              format: 'iife' as const,
              inlineDynamicImports: true,
              entryFileNames: 'app.js',
              assetFileNames: 'app.[ext]',
            },
          },
          chunkSizeWarningLimit: 4000,
        }
      : {
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
